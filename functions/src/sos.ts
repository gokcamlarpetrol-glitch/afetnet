/**
 * AFETNET FIREBASE FUNCTIONS - SOS MODULE
 *
 * Functions:
 * - onSOSAlert: Legacy device-path SOS alert push
 * - onSOSAlertV3: V3 UID-path SOS alert push
 * - onSOSBroadcast: Global proximity-based SOS broadcast
 */

import * as functions from 'firebase-functions/v1';
import type * as FirebaseFirestore from '@google-cloud/firestore';

import {
    db,
    REGION,
    ExpoPushMessage,
    sendPushToToken,
    sendExpoPush,
    isExpoPushToken,
    collectPushTokensForUid,
    resolveAndroidChannelId,
    haversineDistance,
    EMERGENCY_NOTIFICATION_SOUND,
} from './utils';

// ============================================================
// PAGINATION HELPER — EEW modülündeki paginateQuery ile aynı pattern
// ============================================================

const SOS_PAGE_SIZE = 500;
const SOS_MAX_PAGES = 2000; // 1 milyon cihaza kadar destek

async function sosPaginateQuery<T extends FirebaseFirestore.DocumentData = FirebaseFirestore.DocumentData>(
    queryRef: FirebaseFirestore.Query<T>,
    pageSize: number,
    maxPages: number,
    onPage: (docs: FirebaseFirestore.QueryDocumentSnapshot<T>[]) => void,
    label: string,
): Promise<number> {
    let totalSeen = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<T> | null = null;
    let pages = 0;

    while (pages < maxPages) {
        let pageQuery: FirebaseFirestore.Query<T> = queryRef.limit(pageSize);
        if (lastDoc) {
            pageQuery = pageQuery.startAfter(lastDoc);
        }
        const snap = await pageQuery.get();
        if (snap.empty) break;

        onPage(snap.docs);
        totalSeen += snap.docs.length;
        pages++;
        lastDoc = snap.docs[snap.docs.length - 1] ?? null;

        if (snap.docs.length < pageSize) break;
    }

    if (pages >= maxPages) {
        functions.logger.error(
            `SOS pagination cap: ${label} — ${maxPages} sayfa (~${totalSeen} belge). Ölçek sorunu — araştır.`,
        );
    }

    return totalSeen;
}

// ============================================================
// SOS ALERT - FCM PUSH TO FAMILY MEMBERS
// When a family member writes an SOS alert to another device's
// sos_alerts subcollection, this triggers a push notification
// to the target device.
// ============================================================

export const onSOSAlert = functions
    .region(REGION)
    .firestore.document('devices/{deviceId}/sos_alerts/{alertId}')
    .onCreate(async (snap, context) => {
        const alert = snap.data();
        const targetDeviceId = context.params.deviceId;

        // CRITICAL FIX: Skip push for cancelled SOS signals.
        // When broadcastCancellation() creates cancel-{id} documents, they trigger
        // this onCreate. Without this guard, cancellation sends a NEW "emergency" push.
        if (alert.status === 'cancelled') {
            functions.logger.info(`Skipping push for cancelled SOS alert: ${context.params.alertId}`);
            return null;
        }

        // Idempotency guard: onCreate can fire more than once
        if (alert._processed) {
            functions.logger.info(`SOS alert already processed: ${context.params.alertId}`);
            return null;
        }

        functions.logger.warn(`🚨 SOS Alert received for device ${targetDeviceId}:`, {
            sender: alert.senderDeviceId,
            message: alert.message,
            reason: alert.reason,
        });

        try {
            // CRITICAL FIX: FCM tokens are stored by auth.uid, NOT by deviceId.
            // So we first need to find the ownerUid from the device document.
            const deviceDoc = await db.collection('devices').doc(targetDeviceId).get();
            let ownerUid = deviceDoc.exists ? deviceDoc.data()?.ownerUid : null;

            if (!ownerUid) {
                // LIFE-SAFETY FALLBACK CHAIN:
                // 1. Try pushToken directly from device doc (direct send without UID lookup)
                // 2. Try using targetDeviceId AS a UID (client writes to devices/{uid}/sos_alerts too)
                // 3. Log detailed error with all available identifiers for debugging
                const fallbackToken = deviceDoc.exists ? (deviceDoc.data()?.pushToken || deviceDoc.data()?.token) : null;
                if (fallbackToken) {
                    functions.logger.warn(`No ownerUid on device ${targetDeviceId} — using device pushToken fallback`);
                    const fbTitle = `🆘 ACİL SOS: ${alert.senderName || 'Aile Üyesi'}`;
                    const fbBody = alert.message || 'Acil yardım gerekiyor!';
                    // Include battery + healthInfo for SOSHelpScreen display
                    const fbBattery = typeof alert.battery === 'number' ? String(alert.battery) : '';
                    let fbHealthInfo = '';
                    if (alert.healthInfo && typeof alert.healthInfo === 'object') {
                        try { fbHealthInfo = JSON.stringify(alert.healthInfo); } catch { /* skip */ }
                    }
                    const fbPushData: Record<string, string> = {
                        type: 'sos_family',
                        signalId: alert.signalId || context.params.alertId,
                        senderDeviceId: alert.senderDeviceId || '',
                        senderUid: alert.senderUid || alert.userId || '',
                        senderName: alert.senderName || 'Aile Üyesi',
                        fromName: alert.senderName || 'Aile Üyesi',
                        message: alert.message || '',
                        timestamp: String(alert.timestamp || Date.now()),
                        trapped: String(alert.trapped === true),
                        latitude: alert.location?.latitude ? String(alert.location.latitude) : '',
                        longitude: alert.location?.longitude ? String(alert.location.longitude) : '',
                        ...(fbBattery ? { battery: fbBattery } : {}),
                        ...(fbHealthInfo ? { healthInfo: fbHealthInfo } : {}),
                    };
                    const fbSuccess = await sendPushToToken(fallbackToken, fbTitle, fbBody, fbPushData);
                    if (fbSuccess) {
                        // Mark processed to prevent duplicate push on CF retry
                        await snap.ref.update({ _processed: true }).catch(() => {});
                        return null;
                    }
                    // LIFE-SAFETY: Fallback token push failed — throw to trigger CF retry
                    throw new Error(`SOS fallback token push failed for device ${targetDeviceId}`);
                }

                // FALLBACK 2: targetDeviceId might actually BE a Firebase Auth UID.
                // The client writes SOS alerts to both devices/{deviceId} and devices/{uid} paths.
                // Check if push_tokens exist for targetDeviceId treated as a UID.
                functions.logger.warn(`No ownerUid or pushToken on device doc — trying targetDeviceId as UID: ${targetDeviceId}`);
                const uidFallbackTokens = await collectPushTokensForUid(targetDeviceId);
                if (uidFallbackTokens.length > 0) {
                    functions.logger.warn(`Found ${uidFallbackTokens.length} push tokens using targetDeviceId as UID — proceeding with push`);
                    // Use targetDeviceId as the effective ownerUid for the rest of the flow
                    ownerUid = targetDeviceId;
                } else {
                    functions.logger.error(
                        `❌ SOS push LOST: No ownerUid, no pushToken, no tokens for targetDeviceId-as-UID. ` +
                        `Device: ${targetDeviceId}, alert fields: ${JSON.stringify({
                            senderUid: alert.senderUid,
                            userId: alert.userId,
                            senderName: alert.senderName,
                            senderDeviceId: alert.senderDeviceId,
                        })}`
                    );
                    return null;
                }
            }

            // DEDUP FIX (H1: 3s → 5s): SOSChannelRouter writes to BOTH legacy
            // (devices/{id}/sos_alerts) and V3 (sos_alerts/{uid}/items) paths
            // simultaneously. Both onSOSAlert (legacy) and onSOSAlertV3 fire →
            // user receives 2 identical push notifications.
            //
            // Strategy: legacy waits 5s then checks if V3 document exists.
            //   - V3 doc exists → V3 trigger handles push → legacy skips
            //   - V3 doc missing → V3 write failed → legacy sends as safety net
            //
            // Why 5s (was 3s): under load (cold CF instance + Firestore quorum
            // write replication across multi-region), V3 doc occasionally took
            // ~3.5-4.5s to materialize. 3s window meant legacy fired second push
            // even though V3 was about to land. 5s leaves comfortable headroom
            // while still meeting the SOS UX SLO (notification within ~10s).
            //
            // Idempotency: composite key is `${signalId}:${schemaVersion}` —
            // if the same signal arrives twice (CF retry), the `_processed`
            // flag inside the doc prevents duplicate push regardless of timing.
            const alertSignalId = alert.signalId || context.params.alertId;
            const schemaVersion = typeof alert.schemaVersion === 'number' ? alert.schemaVersion : 1;
            const dedupIdempotencyKey = `${alertSignalId}:v${schemaVersion}`;
            try {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for V3 write
                const v3AlertDoc = await db
                    .collection('sos_alerts').doc(ownerUid)
                    .collection('items').doc(alertSignalId)
                    .get();
                if (v3AlertDoc.exists) {
                    functions.logger.info(
                        `✅ SOS dedup [${dedupIdempotencyKey}]: V3 path exists for ${ownerUid}/${alertSignalId} — onSOSAlertV3 will handle push, legacy skipping`
                    );
                    return null;
                }
                functions.logger.warn(
                    `⚠️ SOS dedup [${dedupIdempotencyKey}]: V3 path NOT found for ${ownerUid}/${alertSignalId} after 5s — legacy sending push as safety net`
                );
            } catch (dedupErr) {
                functions.logger.warn(`SOS dedup check failed [${dedupIdempotencyKey}] (continuing with push for safety): ${dedupErr}`);
                // On error, continue with push — better double than none for SOS
            }

            // Collect ALL tokens via shared utility (push_tokens + fcm_tokens + device fallback)
            const deviceFallbackToken = deviceDoc.data()?.pushToken || deviceDoc.data()?.token;
            const allTokens = await collectPushTokensForUid(ownerUid, deviceFallbackToken);

            if (allTokens.length === 0) {
                functions.logger.warn(`No push tokens found for ownerUid: ${ownerUid} (device: ${targetDeviceId})`);
                return null;
            }

            // Build notification
            const lat0 = Number(alert.location?.latitude);
            const lng0 = Number(alert.location?.longitude);
            const locationText = (Number.isFinite(lat0) && Number.isFinite(lng0))
                ? `Konum: ${lat0.toFixed(4)}, ${lng0.toFixed(4)}`
                : 'Konum bilgisi yok';

            const isTrapped = alert.trapped === true;
            const alertSenderName = alert.senderName || 'Aile Üyesi';
            const title = isTrapped
                ? `🚨 ENKAZ ALTINDA: ${alertSenderName}`
                : `🆘 ACİL SOS: ${alertSenderName}`;
            const body = `${alert.message || 'Acil yardım gerekiyor!'}\n${locationText}`;
            const senderUid = typeof alert.senderUid === 'string'
                ? alert.senderUid
                : (typeof alert.userId === 'string' ? alert.userId : '');

            // Send push notification via Expo Push API (tokens are ExponentPushToken[xxx])
            // CRITICAL FIX: Include battery and healthInfo in push data.
            // SOSHelpScreen displays these life-saving fields (battery level, blood type,
            // allergies, medications). Without them in push data, tapping the notification
            // when app is killed/background opens SOSHelp with battery=undefined and
            // healthInfo=undefined — rescue teams lose critical medical info.
            const batteryStr = typeof alert.battery === 'number' ? String(alert.battery) : '';
            // FCM push data values must be strings — JSON-encode healthInfo object
            let healthInfoStr = '';
            if (alert.healthInfo && typeof alert.healthInfo === 'object') {
                try { healthInfoStr = JSON.stringify(alert.healthInfo); } catch { /* skip */ }
            }

            const pushData: Record<string, string> = {
                type: 'sos_family',
                signalId: alert.signalId || context.params.alertId,
                senderDeviceId: alert.senderDeviceId || '',
                senderUid,
                senderName: alert.senderName || 'Aile Üyesi',
                // CRITICAL FIX: Include fromName as backup for senderName.
                // FCM sanitization strips reserved keys (like 'from'). Client fallback
                // chain reads senderName || fromName || from. Without fromName, if senderName
                // is ever lost in transit, the notification shows 'Aile Uyesi' instead of the name.
                fromName: alert.senderName || 'Aile Üyesi',
                message: alert.message || '',
                timestamp: String(alert.timestamp || Date.now()),
                trapped: String(isTrapped),
                latitude: alert.location?.latitude ? String(alert.location.latitude) : '',
                longitude: alert.location?.longitude ? String(alert.location.longitude) : '',
                ...(batteryStr ? { battery: batteryStr } : {}),
                ...(healthInfoStr ? { healthInfo: healthInfoStr } : {}),
            };

            // LIFE-SAFETY: Send to all tokens with retry on failure
            let sentCount = 0;
            const failedTokens: string[] = [];
            for (const pushToken of allTokens) {
                const success = await sendPushToToken(pushToken, title, body, pushData);
                if (success) {
                    sentCount++;
                } else {
                    failedTokens.push(pushToken);
                }
            }

            // CRITICAL: Retry failed tokens once for SOS (life-saving)
            if (failedTokens.length > 0) {
                functions.logger.warn(`SOS push: ${failedTokens.length} tokens failed, retrying once...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                for (const pushToken of failedTokens) {
                    const success = await sendPushToToken(pushToken, title, body, pushData);
                    if (success) sentCount++;
                }
            }

            functions.logger.info(`✅ SOS family push sent: ${sentCount}/${allTokens.length} tokens (device: ${targetDeviceId})`);

            // CRITICAL FIX: Only mark _processed when at least one push succeeded.
            // Previously set unconditionally — if ALL tokens failed (expired, invalid),
            // the SOS alert was marked processed and CF never retried. Life-safety loss.
            if (sentCount > 0 && sentCount >= allTokens.length) {
                // ALL tokens succeeded — safe to mark processed
                await snap.ref.update({ _processed: true }).catch(() => {});
            } else if (sentCount > 0) {
                // PARTIAL success — throw to force retry for remaining tokens.
                // Duplicate notifications on retry are acceptable for life-saving SOS.
                functions.logger.warn(`Partial SOS push: ${sentCount}/${allTokens.length} sent for device ${targetDeviceId} — forcing retry`);
                throw new Error(`Partial SOS delivery: ${sentCount}/${allTokens.length}`);
            } else {
                // ALL tokens failed — throw to trigger CF retry
                throw new Error(`SOS push failed for ALL ${allTokens.length} tokens of device ${targetDeviceId}`);
            }

        } catch (error) {
            functions.logger.error('❌ SOS FCM push failed:', error);
            throw error; // Re-throw to trigger Cloud Functions retry for life-safety delivery
        }

        return null;
    });

// ============================================================
// V3: SOS ALERT - FCM PUSH TO FAMILY MEMBERS (UID PATH)
// Trigger: sos_alerts/{targetUid}/items/{signalId} -> push to targetUid
// Complements the legacy onSOSAlert trigger for the V3 write path.
// SOSChannelRouter writes to BOTH legacy and V3 paths; without this
// trigger, the V3 path would silently not deliver push notifications.
// ============================================================

export const onSOSAlertV3 = functions
    .region(REGION)
    .firestore.document('sos_alerts/{targetUid}/items/{signalId}')
    .onCreate(async (snap, context) => {
        const alert = snap.data();
        const targetUid = context.params.targetUid;
        const signalId = context.params.signalId;

        // CRITICAL FIX: Skip push for cancelled SOS signals.
        if (alert.status === 'cancelled') {
            functions.logger.info(`Skipping V3 push for cancelled SOS alert: ${signalId}`);
            return null;
        }

        // Server fan-out proximity alerts are written by onSOSBroadcast so foreground
        // listeners have a private per-user inbox. The same onSOSBroadcast invocation
        // already sends the batched critical push; sending here too would duplicate alarms.
        if (alert.serverFanout === true && alert.type === 'sos_proximity') {
            functions.logger.info(`Skipping V3 push for server-fanout proximity alert: ${signalId}`);
            return null;
        }

        // IDEMPOTENCY GUARD: Firebase onCreate can fire >1 time for the same document.
        // Use _processed flag to prevent duplicate SOS push notifications.
        // FIX 14: Only CHECK _processed here (early return if already done).
        // The flag is SET after push notifications succeed, so retries re-attempt push.
        if (alert._processed) {
            functions.logger.info(`V3 SOS alert ${signalId} already processed, skipping`);
            return null;
        }

        const startTime = Date.now();

        functions.logger.warn(`🚨 V3 SOS Alert received for user ${targetUid}:`, {
            sender: alert.senderDeviceId,
            message: alert.message,
        });

        try {
            // DEDUP NOTE: Legacy onSOSAlert now defers to this V3 trigger when both paths exist.
            // onSOSAlert waits 3s then checks if this V3 document exists — if yes, it skips push.
            // This V3 trigger is the PREFERRED push sender because targetUid IS the Firebase Auth UID
            // (no intermediate device doc lookup needed = faster + more reliable).

            // V3 path: targetUid IS the Firebase Auth UID — look up tokens directly
            const allTokens = await collectPushTokensForUid(targetUid);

            if (allTokens.length === 0) {
                functions.logger.warn(`No push tokens found for uid: ${targetUid} (V3 SOS alert)`);
                return null;
            }

            const isTrapped = alert.trapped === true;
            const alertSenderName = alert.senderName || 'Aile Üyesi';
            const title = isTrapped
                ? `🚨 ENKAZ ALTINDA: ${alertSenderName}`
                : `🆘 ACİL SOS: ${alertSenderName}`;

            const lat1 = Number(alert.location?.latitude);
            const lng1 = Number(alert.location?.longitude);
            const locationText = (Number.isFinite(lat1) && Number.isFinite(lng1))
                ? `Konum: ${lat1.toFixed(4)}, ${lng1.toFixed(4)}`
                : 'Konum bilgisi yok';
            const body = `${alert.message || 'Acil yardım gerekiyor!'}\n${locationText}`;

            const senderUid = typeof alert.senderUid === 'string'
                ? alert.senderUid
                : (typeof alert.userId === 'string' ? alert.userId : '');

            // CRITICAL FIX: Include battery and healthInfo in push data (same as legacy onSOSAlert).
            const batteryStrV3 = typeof alert.battery === 'number' ? String(alert.battery) : '';
            let healthInfoStrV3 = '';
            if (alert.healthInfo && typeof alert.healthInfo === 'object') {
                try { healthInfoStrV3 = JSON.stringify(alert.healthInfo); } catch { /* skip */ }
            }

            const pushData: Record<string, string> = {
                type: 'sos_family',
                signalId: alert.signalId || context.params.signalId,
                senderDeviceId: alert.senderDeviceId || '',
                senderUid,
                senderName: alertSenderName,
                // CRITICAL FIX: Include fromName as backup for senderName (belt-and-suspenders).
                fromName: alertSenderName,
                message: alert.message || '',
                timestamp: String(alert.timestamp || Date.now()),
                trapped: String(isTrapped),
                latitude: alert.location?.latitude ? String(alert.location.latitude) : '',
                longitude: alert.location?.longitude ? String(alert.location.longitude) : '',
                ...(batteryStrV3 ? { battery: batteryStrV3 } : {}),
                ...(healthInfoStrV3 ? { healthInfo: healthInfoStrV3 } : {}),
            };

            // LIFE-SAFETY: Send to all tokens with retry on failure
            let sentCount = 0;
            const failedTokens: string[] = [];
            for (const pushToken of allTokens) {
                const success = await sendPushToToken(pushToken, title, body, pushData);
                if (success) {
                    sentCount++;
                } else {
                    failedTokens.push(pushToken);
                }
            }

            // CRITICAL: Retry failed tokens once for SOS (life-saving)
            if (failedTokens.length > 0) {
                functions.logger.warn(`V3 SOS push: ${failedTokens.length} tokens failed, retrying once...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                for (const pushToken of failedTokens) {
                    const success = await sendPushToToken(pushToken, title, body, pushData);
                    if (success) sentCount++;
                }
            }

            functions.logger.info(`✅ V3 SOS family push sent: ${sentCount}/${allTokens.length} tokens (uid: ${targetUid}) in ${Date.now() - startTime}ms`);

            // FIX 14+BUG9: Set _processed ONLY when ALL tokens succeeded.
            // Partial success throws to force Cloud Functions retry for remaining tokens.
            // Duplicate notifications on retry are acceptable for life-saving SOS.
            const totalTokens = allTokens.length;
            if (sentCount > 0 && sentCount >= totalTokens) {
                // ALL tokens succeeded — safe to mark processed
                try {
                    await snap.ref.update({ _processed: true });
                } catch {
                    // Non-critical — worst case is a duplicate push on retry, which is acceptable for SOS
                    functions.logger.warn(`V3 SOS alert ${signalId}: _processed flag update failed after push`);
                }
            } else if (sentCount > 0) {
                // PARTIAL success — log but throw to force retry for remaining tokens
                // The already-sent tokens will get duplicate notifications on retry, which is acceptable for SOS
                functions.logger.warn(`Partial SOS push: ${sentCount}/${totalTokens} sent for ${targetUid} — forcing retry`);
                throw new Error(`Partial SOS delivery: ${sentCount}/${totalTokens}`);
            } else {
                // ALL tokens failed — throw to trigger CF retry (life-safety: must not silently return)
                throw new Error(`V3 SOS push failed for ALL ${totalTokens} tokens of user ${targetUid}`);
            }
        } catch (error) {
            // Push failed entirely — do NOT set _processed so retry can re-attempt
            functions.logger.error(`❌ V3 SOS FCM push failed after ${Date.now() - startTime}ms:`, error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }

        return null;
    });

// ============================================================
// GLOBAL SOS BROADCAST - PROXIMITY-BASED PUSH TO ALL NEARBY USERS
// When a user sends a global SOS broadcast, this function finds
// all users within a configurable radius and sends them critical
// push notifications. LIFE-SAVING feature.
// ============================================================

const SOS_RADIUS_KM = 50; // Alert users within 50km radius

export const onSOSBroadcast = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .firestore.document('sos_broadcasts/{broadcastId}')
    .onCreate(async (snap) => {
        const broadcast = snap.data();
        const sosLat = broadcast.latitude;
        const sosLon = broadcast.longitude;
        const senderDeviceId = broadcast.senderDeviceId;
        const hasLocation = broadcast.hasLocation !== false;

        // CRITICAL FIX: Skip push for cancelled SOS broadcasts.
        // When broadcastCancellation() creates cancel-{id} documents in sos_broadcasts,
        // this onCreate fires and would send SOS push to ALL nearby users for a CANCELLED SOS.
        if (broadcast.status === 'cancelled') {
            functions.logger.info(`Skipping push for cancelled SOS broadcast: ${snap.id}`);
            return null;
        }

        // CRITICAL FIX: Idempotency guard — Cloud Functions can fire >1 time for same event.
        // FIX 14: Only CHECK _processed here (early return if push already succeeded).
        // The flag is SET after push notifications succeed, so retries re-attempt push.
        const processedField = broadcast._processed;
        if (processedField === true) {
            functions.logger.info(`SOS broadcast ${snap.id} already processed — skipping duplicate invocation`);
            return;
        }

        // FIX 13: Validate coordinates — reject obviously invalid values (e.g., NaN, out-of-range)
        // so haversineDistance doesn't produce garbage results. Invalid coords are treated as no-location SOS.
        const hasValidCoords = typeof sosLat === 'number' && !isNaN(sosLat) && sosLat >= -90 && sosLat <= 90 &&
            typeof sosLon === 'number' && !isNaN(sosLon) && sosLon >= -180 && sosLon <= 180;
        if (!hasValidCoords && (sosLat !== undefined || sosLon !== undefined)) {
            functions.logger.error(`Invalid SOS coordinates: lat=${sosLat}, lon=${sosLon} — treating as no-location SOS`);
            // Fall through to no-location handling (send to all users)
        }
        // Use validated location flag: hasLocation from client AND valid coordinate values
        const effectiveHasLocation = hasLocation && hasValidCoords;

        functions.logger.warn('🚨 GLOBAL SOS BROADCAST received:', {
            broadcastId: snap.id,
            sender: senderDeviceId,
            hasLocation: effectiveHasLocation,
            location: effectiveHasLocation ? `${sosLat}, ${sosLon}` : 'NO LOCATION',
            message: broadcast.message,
            trapped: broadcast.trapped,
        });

        const startTime = Date.now();

        try {
            // SECURITY (SOS spam koruması): rate-limit bloğunu ATOMİK oku-ve-yaz.
            // Kötü niyetli kullanıcı saniyeler içinde onlarca FARKLI SOS broadcast'i ile
            // çevredeki herkesi spam'leyip gerçek SOS'ların "kurt geldi" etkisiyle yok
            // sayılmasına yol açabilir.
            //
            // KRİTİK (görev #2): Rate-limit, broadcast'in signalId'sine göre uygulanır.
            // Önceki kod yalnızca zaman penceresine bakıyordu — bu, fonksiyonun KENDİ
            // retry'ını kilitliyordu: ilk çalıştırmada kısmi teslimat → throw → CF retry
            // (saniyeler içinde) → retry rate-limit'e takılıp return → kalan kullanıcılar
            // SOS'u HİÇ ALMIYORDU. Çözüm: aynı signalId'nin yeniden çalışması (CF retry
            // veya istemcinin aynı sinyali yeniden yayını) her zaman izinli; yalnız FARKLI
            // bir signalId 60 sn içinde gelirse engellenir — gerçek spam koruması korunur.
            if (typeof broadcast.senderUid === 'string' && broadcast.senderUid) {
                const rlRef = db.collection('rate_limits').doc(broadcast.senderUid);
                const thisSignalId = typeof broadcast.signalId === 'string' && broadcast.signalId
                    ? broadcast.signalId
                    : snap.id;
                let rateLimited = false;
                try {
                    await db.runTransaction(async (tx) => {
                        const rlSnap = await tx.get(rlRef);
                        const rlData = rlSnap.exists ? rlSnap.data() : undefined;
                        const blockedUntil = rlData?.sosBlockedUntil;
                        const blockedBySignalId = rlData?.sosBlockedBySignalId;
                        // Pencere aktif VE farklı bir sinyal tarafından açılmışsa engelle.
                        // Aynı sinyalin tekrarı (retry) engellenmez — teslimat tamamlanmalı.
                        if (typeof blockedUntil === 'number' && Date.now() < blockedUntil
                            && blockedBySignalId !== thisSignalId) {
                            rateLimited = true;
                            return;
                        }
                        tx.set(rlRef, {
                            sosBlockedUntil: Date.now() + 60_000,
                            sosBlockedBySignalId: thisSignalId,
                            sosLastBroadcastAt: Date.now(),
                        }, { merge: true });
                    });
                } catch (rateErr) {
                    // Fail-open: transaction hatası SOS'u engellemez — rate-limit bir
                    // koruma katmanı, hayati SOS'un kendisinden daha az kritiktir.
                    functions.logger.warn(`SOS rate-limit transaction failed for ${broadcast.senderUid}:`, rateErr);
                }
                if (rateLimited) {
                    functions.logger.warn(`SOS broadcast ${snap.id} rate-limited for ${broadcast.senderUid} (farklı signalId 60sn içinde) — skipping`);
                    return null;
                }
            }

            // 1. Get ALL users from BOTH legacy devices AND V3 locations_current
            // Sayfalı tarama ile bellek-güvenli: limit(10000) yerine paginateQuery kullanılır.
            // Her sayfa 500 belge, max 2000 sayfa → 1M cihaza kadar destek, RAM güvenli.
            const queryStartTime = Date.now();

            // CRITICAL: Collect ALL ownerUids — never skip devices just because they lack location
            const targetOwnerUids: Set<string> = new Set();
            let skippedSender = 0;
            let devicesWithLocation = 0;
            let devicesWithoutLocation = 0;
            let devicesWithOwnerUid = 0;
            let devicesWithoutOwnerUid = 0;
            let nearbyCount = 0;
            let totalDevicesSeen = 0;
            let totalLocationsSeen = 0;

            // 1a. Legacy devices collection — sayfalı tarama
            totalDevicesSeen = await sosPaginateQuery(
                db.collection('devices').select('location', 'ownerUid'),
                SOS_PAGE_SIZE,
                SOS_MAX_PAGES,
                (docs) => {
                    for (const deviceDoc of docs) {
                        const deviceData = deviceDoc.data();
                        const deviceId = deviceDoc.id;

                        if (deviceId === senderDeviceId) {
                            skippedSender++;
                            continue;
                        }

                        const ownerUid = deviceData?.ownerUid;
                        if (typeof ownerUid !== 'string' || !ownerUid) {
                            devicesWithoutOwnerUid++;
                            continue;
                        }
                        devicesWithOwnerUid++;

                        const deviceLat = deviceData?.location?.latitude;
                        const deviceLon = deviceData?.location?.longitude;
                        const deviceHasLocation = typeof deviceLat === 'number' && typeof deviceLon === 'number';

                        if (deviceHasLocation) {
                            devicesWithLocation++;
                        } else {
                            devicesWithoutLocation++;
                        }

                        if (effectiveHasLocation && deviceHasLocation) {
                            const distance = haversineDistance(sosLat, sosLon, deviceLat, deviceLon);
                            if (distance <= SOS_RADIUS_KM) {
                                targetOwnerUids.add(ownerUid);
                                nearbyCount++;
                            }
                        }
                        // Public proximity SOS requires both sender and receiver locations.
                    }
                },
                'devices',
            );

            // 1b. V3 locations_current collection — sayfalı tarama; doc ID = user UID
            totalLocationsSeen = await sosPaginateQuery(
                db.collection('locations_current').select('latitude', 'longitude'),
                SOS_PAGE_SIZE,
                SOS_MAX_PAGES,
                (docs) => {
                    for (const locDoc of docs) {
                        const uid = locDoc.id;
                        if (targetOwnerUids.has(uid)) continue; // Zaten devices'dan eklendi

                        const locData = locDoc.data();
                        const locLat = locData?.latitude;
                        const locLon = locData?.longitude;
                        const locHasLocation = typeof locLat === 'number' && typeof locLon === 'number';

                        if (effectiveHasLocation && locHasLocation) {
                            const distance = haversineDistance(sosLat, sosLon, locLat, locLon);
                            if (distance <= SOS_RADIUS_KM) {
                                targetOwnerUids.add(uid);
                                nearbyCount++;
                            }
                        }
                    }
                },
                'locations_current',
            );

            const queryLatencyMs = Date.now() - queryStartTime;
            functions.logger.info(`Toplam cihaz belgeleri: ${totalDevicesSeen}, V3 konum belgeleri: ${totalLocationsSeen}, sorgu süresi: ${queryLatencyMs}ms`);

            // Remove sender's own uid to prevent self-notification
            // LIFE-SAFETY: Use ALL available sender identifiers for robust self-exclusion
            // 1. Direct fields from broadcast document (most reliable, no lookup needed)
            if (typeof broadcast.senderUid === 'string' && broadcast.senderUid) {
                targetOwnerUids.delete(broadcast.senderUid);
                functions.logger.info(`🔇 Excluded sender via senderUid: ${broadcast.senderUid}`);
            }
            if (typeof broadcast.userId === 'string' && broadcast.userId) {
                targetOwnerUids.delete(broadcast.userId);
                functions.logger.info(`🔇 Excluded sender via userId: ${broadcast.userId}`);
            }
            // 2. Fallback: device doc lookup (for cases where senderUid/userId differ from ownerUid)
            if (senderDeviceId) {
                try {
                    const senderDeviceDoc = await db.collection('devices').doc(senderDeviceId).get();
                    const senderOwnerUid = senderDeviceDoc.exists ? senderDeviceDoc.data()?.ownerUid : null;
                    if (senderOwnerUid) {
                        targetOwnerUids.delete(senderOwnerUid);
                        functions.logger.info(`🔇 Excluded sender via device ownerUid: ${senderOwnerUid}`);
                    }
                } catch { /* device doc lookup failed — direct exclusion above should suffice */ }
            }

            functions.logger.info(`📊 Device discovery results:`, {
                totalDevices: totalDevicesSeen,
                skippedSender,
                devicesWithOwnerUid,
                devicesWithoutOwnerUid,
                devicesWithLocation,
                devicesWithoutLocation,
                nearbyWithinRadius: nearbyCount,
                totalTargetUsers: targetOwnerUids.size,
            });

            if (targetOwnerUids.size === 0) {
                functions.logger.warn('⚠️ No target users found for SOS broadcast — nobody to notify');
                return null;
            }

            // 1c. Server-authoritative per-user alert fan-out.
            // Clients must not subscribe to the global sos_broadcasts collection because
            // Firestore rules cannot enforce geo-distance on reads. This targeted inbox
            // preserves foreground delivery while keeping global broadcast docs private.
            try {
                const signalId = typeof broadcast.signalId === 'string' && broadcast.signalId
                    ? broadcast.signalId
                    : snap.id;
                const targetedAlert = {
                    signalId,
                    senderDeviceId: senderDeviceId || '',
                    senderUid: typeof broadcast.senderUid === 'string' ? broadcast.senderUid : '',
                    senderName: broadcast.senderName || 'Yakındaki Kullanıcı',
                    message: broadcast.message || 'Yakınında biri acil yardım istiyor!',
                    reason: broadcast.reason || 'SOS',
                    location: effectiveHasLocation ? {
                        latitude: sosLat,
                        longitude: sosLon,
                        accuracy: typeof broadcast.accuracy === 'number' ? broadcast.accuracy : null,
                    } : null,
                    trapped: broadcast.trapped === true,
                    battery: typeof broadcast.battery === 'number' ? broadcast.battery : null,
                    timestamp: typeof broadcast.timestamp === 'number' ? broadcast.timestamp : Date.now(),
                    status: 'active',
                    type: 'sos_proximity',
                    serverFanout: true,
                };

                const targetUids = Array.from(targetOwnerUids);
                const WRITE_BATCH_SIZE = 450;
                for (let i = 0; i < targetUids.length; i += WRITE_BATCH_SIZE) {
                    const batch = db.batch();
                    for (const uid of targetUids.slice(i, i + WRITE_BATCH_SIZE)) {
                        const alertRef = db.collection('sos_alerts').doc(uid).collection('items').doc(signalId);
                        batch.set(alertRef, targetedAlert, { merge: true });
                    }
                    await batch.commit();
                }
                functions.logger.info(`✅ Targeted SOS inbox fan-out written for ${targetUids.length} nearby users`);
            } catch (fanoutError) {
                functions.logger.error('Targeted SOS inbox fan-out failed:', fanoutError);
                throw fanoutError;
            }

            // 2. Build notification
            const isTrapped = broadcast.trapped === true;
            const title = isTrapped
                ? '🚨 ENKAZ ALTINDA BİRİ VAR!'
                : '🆘 YAKININDA ACİL SOS ÇAĞRISI!';

            const locationText = effectiveHasLocation
                ? `Konum: ${Number(sosLat).toFixed(4)}, ${Number(sosLon).toFixed(4)}`
                : 'Konum bilgisi yok';
            const body = `${broadcast.message || 'Yakınında biri acil yardım istiyor!'}\n${locationText}`;

            // 3. Collect ALL push tokens for target users — batched parallel
            const tokensToSend: string[] = [];
            const seenTokens = new Set<string>();
            let tokenLookupSuccess = 0;
            let tokenLookupMiss = 0;

            const BATCH_SIZE = 50;
            const uidArray = Array.from(targetOwnerUids);
            for (let i = 0; i < uidArray.length; i += BATCH_SIZE) {
                const batch = uidArray.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (uid) => {
                    try {
                        const tokens = await collectPushTokensForUid(uid);
                        if (tokens.length === 0) {
                            tokenLookupMiss++;
                            functions.logger.warn(`⚠️ No push token for user ${uid}`);
                        } else {
                            for (const t of tokens) {
                                if (!seenTokens.has(t)) {
                                    seenTokens.add(t);
                                    tokensToSend.push(t);
                                    tokenLookupSuccess++;
                                }
                            }
                        }
                    } catch (err) {
                        functions.logger.warn(`⚠️ Token lookup failed for user ${uid}: ${err}`);
                    }
                }));
            }

            functions.logger.info(`📊 Token collection: ${tokenLookupSuccess} found, ${tokenLookupMiss} missing, ${tokensToSend.length} total tokens to send`);

            if (tokensToSend.length === 0) {
                functions.logger.warn('⚠️ No push tokens found — cannot send SOS notifications');
                return null;
            }

            // 4. Send push notifications via Expo Push API
            // MEDIUM FIX: Validate lat/lon before stringifying to avoid "undefined"/"NaN" in push data
            const hasValidLocation = typeof sosLat === 'number' && !isNaN(sosLat) && typeof sosLon === 'number' && !isNaN(sosLon);
            // Public proximity push intentionally excludes healthInfo. Medical data is only
            // shared through consent-gated family/rescue/mesh health channels.
            const broadcastBatteryStr = typeof broadcast.battery === 'number' ? String(broadcast.battery) : '';
            const pushData: Record<string, string> = {
                type: 'sos_proximity',
                signalId: broadcast.signalId || snap.id,
                senderDeviceId: senderDeviceId || '',
                senderUid: typeof broadcast.senderUid === 'string' ? broadcast.senderUid : '',
                senderName: broadcast.senderName || 'Yakındaki Kullanıcı',
                // CRITICAL FIX: Include fromName as backup for senderName (belt-and-suspenders).
                fromName: broadcast.senderName || 'Yakındaki Kullanıcı',
                message: broadcast.message || '',
                timestamp: String(broadcast.timestamp || Date.now()),
                trapped: String(isTrapped),
                latitude: hasValidLocation ? String(sosLat) : '',
                longitude: hasValidLocation ? String(sosLon) : '',
                ...(broadcastBatteryStr ? { battery: broadcastBatteryStr } : {}),
            };

            let sentCount = 0;
            const expoTokens = tokensToSend.filter(isExpoPushToken);
            const nativeTokens = tokensToSend.filter(t => !isExpoPushToken(t));

            functions.logger.info(`📊 Token types: ${expoTokens.length} Expo, ${nativeTokens.length} native FCM`);

            if (expoTokens.length > 0) {
                const expoMessages: ExpoPushMessage[] = expoTokens.map(token => ({
                    to: token,
                    title,
                    body,
                    data: pushData,
                    sound: EMERGENCY_NOTIFICATION_SOUND,
                    priority: 'high' as const,
                    channelId: resolveAndroidChannelId(pushData),
                    // G2: iOS notification category enables the "Yardıma git" /
                    // "Kapat" quick action buttons registered in NotificationCenter.
                    // Without categoryId the buttons never appear on the lock
                    // screen / banner, forcing the rescuer to open the app fully.
                    categoryId: 'sos',
                }));

                // Expo API supports batches of up to 100
                for (let i = 0; i < expoMessages.length; i += 100) {
                    const batch = expoMessages.slice(i, i + 100);
                    const result = await sendExpoPush(batch);
                    sentCount += result.successCount;
                    functions.logger.info(`📤 Expo batch ${Math.floor(i / 100) + 1}: ${result.successCount} success, ${result.failCount} failed`);
                }
            }

            // Send to any native FCM tokens (unlikely but supported) with retry
            const failedNativeTokens: string[] = [];
            for (const token of nativeTokens) {
                const success = await sendPushToToken(token, title, body, pushData);
                if (success) {
                    sentCount++;
                } else {
                    failedNativeTokens.push(token);
                }
            }

            // CRITICAL: Retry failed native tokens once for SOS (life-saving)
            if (failedNativeTokens.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                for (const token of failedNativeTokens) {
                    const success = await sendPushToToken(token, title, body, pushData);
                    if (success) sentCount++;
                }
            }

            functions.logger.warn(`✅ GLOBAL SOS BROADCAST COMPLETED: ${sentCount}/${tokensToSend.length} push notifications delivered to ${targetOwnerUids.size} users in ${Date.now() - startTime}ms`);

            // FIX 14+BUG9: Set _processed ONLY when ALL tokens succeeded.
            // Partial success throws to force Cloud Functions retry for remaining tokens.
            // Duplicate notifications on retry are acceptable for life-saving SOS.
            const totalTokens = tokensToSend.length;
            if (sentCount > 0 && sentCount >= totalTokens) {
                // ALL tokens succeeded — safe to mark processed
                try {
                    await snap.ref.update({ _processed: true });
                } catch {
                    // Non-critical — worst case is a duplicate push on retry, acceptable for SOS
                    functions.logger.warn(`SOS broadcast ${snap.id}: _processed flag update failed after push`);
                }
            } else if (sentCount > 0) {
                // PARTIAL success — log but throw to force retry for remaining tokens
                // The already-sent tokens will get duplicate notifications on retry, which is acceptable for SOS
                functions.logger.warn(`Partial SOS broadcast push: ${sentCount}/${totalTokens} sent — forcing retry`);
                throw new Error(`Partial SOS broadcast delivery: ${sentCount}/${totalTokens}`);
            } else {
                // ALL tokens failed — throw to trigger CF retry (life-safety: must not silently return)
                throw new Error(`SOS broadcast push failed for ALL ${totalTokens} tokens`);
            }

        } catch (error) {
            // Push failed entirely — do NOT set _processed so retry can re-attempt
            functions.logger.error(`❌ Global SOS broadcast FAILED after ${Date.now() - startTime}ms:`, error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }

        return null;
    });

// ============================================================
// GLOBAL SOS BROADCAST CANCELLATION FAN-OUT
// Keeps server-created sos_alerts/{uid}/items documents in sync when the
// sender cancels the original sos_broadcasts/{broadcastId} document.
// ============================================================

export const onSOSBroadcastUpdated = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .firestore.document('sos_broadcasts/{broadcastId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        if (before?.status === 'cancelled' || after?.status !== 'cancelled') {
            return null;
        }

        const signalId = typeof after?.signalId === 'string' && after.signalId
            ? after.signalId
            : context.params.broadcastId;
        const cancelledAt = typeof after?.cancelledAt === 'number'
            ? after.cancelledAt
            : Date.now();

        try {
            // KRİTİK (görev #3): İptal fan-out'u SAYFALI. Önceki kod limit(10000) ile
            // tek sorgu yapıyordu — ileri-yön onSOSBroadcast ~1M cihaza fan-out yaparken
            // iptal 10.000'de kesiliyordu. Kitlesel olayda 10k üstü kullanıcıda iptal
            // edilen SOS SONSUZA DEK aktif kalıyor (hayalet SOS — kurtarma ekibi çoktan
            // kurtulmuş kişiye gider). Artık ileri-yönle aynı kapasite: SOS_PAGE_SIZE ×
            // SOS_MAX_PAGES (~1M belge), her sayfa commit edilerek bellek-güvenli.
            const cancelQuery = db
                .collectionGroup('items')
                .where('signalId', '==', signalId);

            const WRITE_BATCH_SIZE = 450;
            let updatedCount = 0;
            let pages = 0;
            let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

            while (pages < SOS_MAX_PAGES) {
                let pageQuery = cancelQuery.limit(SOS_PAGE_SIZE);
                if (lastDoc) {
                    pageQuery = pageQuery.startAfter(lastDoc);
                }
                const pageSnap = await pageQuery.get();
                if (pageSnap.empty) break;

                for (let i = 0; i < pageSnap.docs.length; i += WRITE_BATCH_SIZE) {
                    const batch = db.batch();
                    for (const docSnap of pageSnap.docs.slice(i, i + WRITE_BATCH_SIZE)) {
                        batch.set(docSnap.ref, {
                            status: 'cancelled',
                            cancelledAt,
                        }, { merge: true });
                        updatedCount++;
                    }
                    await batch.commit();
                }

                pages++;
                lastDoc = pageSnap.docs[pageSnap.docs.length - 1] ?? null;
                if (pageSnap.docs.length < SOS_PAGE_SIZE) break;
            }

            if (pages >= SOS_MAX_PAGES) {
                functions.logger.error(
                    `SOS iptal fan-out sayfalama tavanı: ${signalId} — ${SOS_MAX_PAGES} sayfa. Ölçek sorunu — araştır.`,
                );
            }

            if (updatedCount === 0) {
                functions.logger.info(`SOS broadcast cancellation: no V3 alert docs found for ${signalId}`);
                return null;
            }

            functions.logger.info(`✅ SOS broadcast cancellation fan-out updated ${updatedCount} V3 alert docs for ${signalId}`);
        } catch (error) {
            functions.logger.error(`SOS broadcast cancellation fan-out failed for ${signalId}:`, error);
            throw error;
        }

        return null;
    });
