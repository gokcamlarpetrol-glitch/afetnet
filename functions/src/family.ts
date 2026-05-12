/**
 * AFETNET FIREBASE FUNCTIONS - FAMILY MODULE
 *
 * Functions:
 * - onFamilyStatusUpdate: Legacy device-path family status push
 * - onFamilyStatusUpdateV3: V3 UID-path family status push
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import {
    db,
    REGION,
    sendPushToToken,
    collectPushTokensForUid,
    normalizeUid,
} from './utils';

// ============================================================
// FAMILY STATUS HELPERS
// ============================================================

function normalizeFamilyStatus(value: unknown): 'safe' | 'need-help' | 'critical' | 'unknown' {
    if (value === 'safe' || value === 'need-help' || value === 'critical') return value;
    return 'unknown';
}

function isFamilyStatusFanoutPayload(updateData: admin.firestore.DocumentData): boolean {
    const senderUid = normalizeUid(updateData?.senderUid) || normalizeUid(updateData?.fromUid);
    const senderDeviceId = typeof updateData?.fromDeviceId === 'string' ? updateData.fromDeviceId.trim() : '';
    return Boolean(senderUid || senderDeviceId);
}

async function dispatchFamilyStatusPush(
    ownerUid: string,
    updateData: admin.firestore.DocumentData,
    payloadDeviceId: string,
    fallbackToken?: string,
): Promise<number> {
    const senderDeviceId = typeof updateData.fromDeviceId === 'string' ? updateData.fromDeviceId : '';
    const senderUid = typeof updateData.senderUid === 'string'
        ? updateData.senderUid
        : (typeof updateData.fromUid === 'string' ? updateData.fromUid : '');
    const senderName = typeof updateData.fromName === 'string' && updateData.fromName.trim().length > 0
        ? updateData.fromName
        : 'Aile Üyesi';
    const status = normalizeFamilyStatus(updateData.status);

    // Prevent self-notification loops for status writes on sender's own path.
    if ((senderUid && senderUid === ownerUid) || (senderDeviceId && senderDeviceId === payloadDeviceId)) {
        functions.logger.debug(`onFamilyStatusUpdate: skipping self-notification for ${ownerUid}`);
        return -1; // Skipped intentionally — mark as processed
    }

    const allTokens = await collectPushTokensForUid(ownerUid, fallbackToken);
    if (allTokens.length === 0) {
        functions.logger.debug(`onFamilyStatusUpdate: no push token for user ${ownerUid}`);
        return -1; // No tokens — mark as processed (retry won't help)
    }

    const isCritical = status === 'critical';
    const statusEmoji = status === 'safe' ? '✅' : status === 'need-help' ? '🆘' : '🚨';
    const statusText = status === 'safe' ? 'Güvendeyim' :
        status === 'need-help' ? 'Yardıma İhtiyacım Var' :
            status === 'critical' ? 'ACİL DURUM' : 'Durum Güncellemesi';

    const title = isCritical ? `🚨 ACİL: ${senderName}` : `${statusEmoji} ${senderName}`;
    const body = isCritical
        ? `${senderName} acil durum bildirdi! Hemen kontrol edin.`
        : `${senderName}: ${statusText}`;

    const pushData: Record<string, string> = {
        type: 'family_status_update',
        status,
        senderDeviceId,
        senderUid,
        senderName,
        // CRITICAL FIX: Include fromName as backup for senderName.
        // FCM sanitization strips reserved keys (like 'from'). Client fallback
        // chain reads senderName || fromName || from. Belt-and-suspenders pattern.
        fromName: senderName,
        deviceId: payloadDeviceId,
        memberName: senderName,
    };

    const location = updateData.location;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        pushData.latitude = String(latitude);
        pushData.longitude = String(longitude);
    }

    let totalSent = 0;
    for (const pushToken of allTokens) {
        const success = await sendPushToToken(pushToken, title, body, pushData);
        if (success) totalSent++;
    }

    if (totalSent > 0) {
        functions.logger.info(`✅ Family status push sent to ${totalSent}/${allTokens.length} devices: ${senderName} → ${ownerUid} (${status})`);
    } else {
        functions.logger.warn(`⚠️ Family status push failed for ALL ${allTokens.length} devices of ${ownerUid}`);
    }

    return totalSent;
}

// ============================================================
// ON FAMILY STATUS UPDATE — Push Notification for Family Alerts
// Trigger: devices/{deviceId}/status_updates/{updateId} -> onCreate
// Flow: Get device ownerUid -> look up fcm_tokens/{ownerUid} -> push
// ============================================================

export const onFamilyStatusUpdate = functions
    .region(REGION)
    .firestore.document('devices/{deviceId}/status_updates/{updateId}')
    .onCreate(async (snap, context) => {
        const { deviceId } = context.params;
        const updateData = snap.data();

        if (!updateData) {
            functions.logger.warn('onFamilyStatusUpdate: empty update data');
            return;
        }

        // Idempotency guard: onCreate can fire >1 time
        if (updateData._processed) return;

        try {
            // Step 1: Get the ownerUid of the device receiving the status
            const deviceDoc = await db.collection('devices').doc(deviceId).get();
            const fallbackToken = deviceDoc.exists
                ? (deviceDoc.data()?.pushToken || deviceDoc.data()?.token || '')
                : '';

            const deviceOwnerUid = deviceDoc.exists ? normalizeUid(deviceDoc.data()?.ownerUid) : '';
            const recipientUid = deviceOwnerUid || normalizeUid(deviceId) || normalizeUid(updateData.targetUid) || normalizeUid(updateData.uid);
            if (!recipientUid) {
                functions.logger.warn(`onFamilyStatusUpdate: could not resolve recipient uid for devices/${deviceId}/status_updates/${context.params.updateId}`);
                return;
            }

            const result = await dispatchFamilyStatusPush(recipientUid, updateData, deviceId, fallbackToken);

            // CRITICAL FIX: Only mark as processed when push was sent OR intentionally skipped.
            // result > 0: push sent. result === -1: skipped (self/no-tokens).
            // result === 0: ALL tokens failed — do NOT mark processed so CF retries.
            // Without this, a transient push failure permanently loses the notification.
            if (result !== 0) {
                await snap.ref.update({ _processed: true }).catch(() => {});
            }
        } catch (error) {
            functions.logger.error('onFamilyStatusUpdate error:', error);
            throw error; // Re-throw for CF retry — family status is life-safety
        }
    });

// ============================================================
// V3: ON FAMILY STATUS UPDATE (UID PATH)
// Trigger: users/{uid}/status_updates/{updateId} -> onCreate
// ============================================================

export const onFamilyStatusUpdateV3 = functions
    .region(REGION)
    .firestore.document('users/{uid}/status_updates/{updateId}')
    .onCreate(async (snap, context) => {
        const recipientUid = normalizeUid(context.params.uid);
        const updateData = snap.data();

        if (!updateData) {
            functions.logger.warn('onFamilyStatusUpdateV3: empty update data');
            return;
        }

        // Idempotency guard: onCreate can fire >1 time
        if (updateData._processed) return;

        // Skip user-owned status history records that are not family fan-out payloads.
        // Those docs are written for self history (saveStatusUpdateV3) and should not trigger pushes.
        if (!isFamilyStatusFanoutPayload(updateData)) {
            functions.logger.debug(`onFamilyStatusUpdateV3: skipped non-fanout payload users/${context.params.uid}/status_updates/${context.params.updateId}`);
            return;
        }

        if (!recipientUid) {
            functions.logger.warn(`onFamilyStatusUpdateV3: invalid uid in path users/${context.params.uid}/status_updates/${context.params.updateId}`);
            return;
        }

        try {
            const result = await dispatchFamilyStatusPush(recipientUid, updateData, recipientUid);

            // CRITICAL FIX: Only mark as processed when push was sent or skipped.
            // result === 0 means ALL tokens failed — retry may succeed later.
            if (result !== 0) {
                await snap.ref.update({ _processed: true }).catch(() => {});
            }
        } catch (error) {
            functions.logger.error('onFamilyStatusUpdateV3 error:', error);
            throw error; // Re-throw for CF retry — family status is life-safety
        }
    });
