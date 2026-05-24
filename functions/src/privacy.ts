/**
 * AFETNET FIREBASE FUNCTIONS - PRIVACY / GDPR / KVKK MODULE
 *
 * KVKK Madde 11 / GDPR Madde 15 kapsamında veri ihraç fonksiyonu.
 *
 * Functions:
 * - exportUserData: Kullanıcının kendi verisini JSON olarak döndürür.
 *   Büyük payloadlarda Storage'a yazıp signed URL döner.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { db, REGION } from './utils';

// ============================================================
// SABİTLER
// ============================================================

/** Saatte en fazla kaç kez export talebi alınabilir */
const EXPORT_RATE_LIMIT_PER_HOUR = 2;

/** Bu boyutun üzerindeki JSON payload'ları Storage'a yazılır */
const INLINE_SIZE_LIMIT_BYTES = 900_000; // ~900 KB (callable response limit ~1 MB)

/** Storage'daki signed URL geçerlilik süresi */
const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 saat

// ============================================================
// GDPR / KVKK VERİ İHRACI
// ============================================================

export const exportUserData = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .https.onCall(async (_data, context) => {
        // Auth gate — kimlik doğrulaması zorunlu
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Bu işlem için giriş yapmanız gerekmektedir.',
            );
        }

        const uid = context.auth.uid;

        // Görev #24 — Rate limit + log-write atomik transaction ile yapılıyor.
        // count().get() + ayrı .add() iki eşzamanlı çağrının her ikisini de geçirir.
        // openAIChatProxy'deki checkRateLimitPersistent deseniyle eşleşir (admin.ts satır 67-86).
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const rateLimitRef = db.collection('privacy_rate_limits').doc(uid);

        let exportLogRef!: FirebaseFirestore.DocumentReference;
        let rateLimitExceeded = false;

        await db.runTransaction(async (tx) => {
            const rateLimitDoc = await tx.get(rateLimitRef);
            const data = rateLimitDoc.exists ? rateLimitDoc.data() : undefined;
            const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : 0;
            const count = typeof data?.count === 'number' ? data.count : 0;

            // Pencere dolmuşsa sıfırla, yoksa güncelle
            const inWindow = windowStart > oneHourAgo;
            const currentCount = inWindow ? count : 0;

            if (currentCount >= EXPORT_RATE_LIMIT_PER_HOUR) {
                rateLimitExceeded = true;
                return;
            }

            // Sayacı artır — transaction içinde atomik
            tx.set(rateLimitRef, {
                windowStart: inWindow ? windowStart : now,
                count: currentCount + 1,
                uid,
            }, { merge: true });

            // Export kaydını da aynı transaction içinde oluştur
            exportLogRef = db.collection('privacy_export_logs').doc();
            tx.set(exportLogRef, {
                uid,
                requestedAt: now,
                status: 'processing',
            });
        });

        if (rateLimitExceeded) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Saatte en fazla 2 kez veri ihraç talebinde bulunabilirsiniz. Lütfen daha sonra tekrar deneyin.',
            );
        }

        try {
            // 1. Kullanıcı profili — users/{uid}
            const userDoc = await db.collection('users').doc(uid).get();
            const userProfile = userDoc.exists ? sanitizeUserProfile(userDoc.data()) : null;

            // 2. Cihazlar — devices koleksiyonu ownerUid filtresi
            const devicesSnap = await db
                .collection('devices')
                .where('ownerUid', '==', uid)
                .limit(50)
                .get();
            const devices = devicesSnap.docs.map(d => sanitizeDevice(d.data(), d.id));

            // 3. Konum geçmişi — locations_history/{uid}/points (sadece metadata)
            let locationHistoryCount = 0;
            let locationHistoryOldestMs: number | null = null;
            let locationHistoryNewestMs: number | null = null;
            try {
                let locSnap = await db
                    .collection('locations_history')
                    .doc(uid)
                    .collection('points')
                    .orderBy('timestamp', 'asc')
                    .limit(500)
                    .get();
                if (locSnap.empty) {
                    locSnap = await db
                        .collection('location_history')
                        .doc(uid)
                        .collection('points')
                        .orderBy('timestamp', 'asc')
                        .limit(500)
                        .get();
                }
                locationHistoryCount = locSnap.size;
                if (locSnap.size > 0) {
                    const firstTs = locSnap.docs[0]?.data()?.timestamp;
                    const lastTs = locSnap.docs[locSnap.size - 1]?.data()?.timestamp;
                    locationHistoryOldestMs = toTimestampMs(firstTs) || null;
                    locationHistoryNewestMs = toTimestampMs(lastTs) || null;
                }
            } catch {
                // Konum geçmişi koleksiyonu yoksa devam et
            }

            // 4. Sağlık profili özeti — users/{uid}/health/current
            let healthProfileSummary: Record<string, unknown> | null = null;
            try {
                let healthDoc = await db
                    .collection('users')
                    .doc(uid)
                    .collection('health')
                    .doc('current')
                    .get();
                if (!healthDoc.exists) {
                    healthDoc = await db.collection('health_profiles').doc(uid).get();
                }
                if (healthDoc.exists) {
                    healthProfileSummary = sanitizeHealthProfile(healthDoc.data());
                }
            } catch {
                // Sağlık profili yoksa devam et
            }

            // 5. Mesaj metadata — conversationId + timestamp + type, içerik YOK
            const messageMetadataList: MessageMetadataEntry[] = [];
            try {
                const msgSnap = await db
                    .collectionGroup('messages')
                    .where('senderUid', '==', uid)
                    .limit(1000)
                    .get();
                for (const msgDoc of msgSnap.docs) {
                    const m = msgDoc.data();
                    const parentConversationRef = msgDoc.ref.parent.parent;
                    messageMetadataList.push({
                        messageId: msgDoc.id,
                        conversationId: typeof m.conversationId === 'string'
                            ? m.conversationId
                            : (parentConversationRef?.id || ''),
                        timestamp: toTimestampMs(m.timestamp),
                        type: typeof m.type === 'string'
                            ? m.type
                            : (typeof m.mediaType === 'string' ? m.mediaType : 'unknown'),
                        // İçerik (text, media URL, vb.) export'a dahil edilmez
                    });
                }
                messageMetadataList.sort((a, b) => b.timestamp - a.timestamp);
            } catch {
                // Mesaj koleksiyonu yoksa devam et
            }

            // 6. SOS geçmişi — sos_alerts/{uid}/items
            const sosHistoryList: SOSHistoryEntry[] = [];
            try {
                const sosSnap = await db
                    .collection('sos_alerts')
                    .doc(uid)
                    .collection('items')
                    .orderBy('timestamp', 'desc')
                    .limit(200)
                    .get();
                for (const sosDoc of sosSnap.docs) {
                    const s = sosDoc.data();
                    sosHistoryList.push({
                        signalId: sosDoc.id,
                        timestamp: typeof s.timestamp === 'number' ? s.timestamp : 0,
                        status: typeof s.status === 'string' ? s.status : 'unknown',
                        type: typeof s.type === 'string' ? s.type : 'unknown',
                        trapped: s.trapped === true,
                        hasLocation: Boolean(s.location),
                    });
                }
            } catch {
                // SOS geçmişi yoksa devam et
            }

            // Payload oluştur
            const payload = {
                exportVersion: '1.0',
                exportedAt: new Date().toISOString(),
                legalBasis: 'KVKK Madde 11 / GDPR Article 15 — Veri Sahibi Erişim Hakkı',
                uid,
                userProfile,
                devices,
                locationHistorySummary: {
                    pointCount: locationHistoryCount,
                    oldestTimestampMs: locationHistoryOldestMs,
                    newestTimestampMs: locationHistoryNewestMs,
                    note: 'Konum noktaları 90 gün sonra otomatik silinir.',
                },
                healthProfileSummary,
                messageMetadata: {
                    count: messageMetadataList.length,
                    note: 'Mesaj içerikleri bu export kapsamında yer almaz; yalnızca metadata (ID, zaman, tür) içerir.',
                    entries: messageMetadataList,
                },
                sosHistory: sosHistoryList,
            };

            const jsonStr = JSON.stringify(payload, null, 2);
            const byteLength = Buffer.byteLength(jsonStr, 'utf8');

            functions.logger.info(`Veri ihraç talebi: uid=${uid}, boyut=${byteLength} bayt`);

            // Log başarılı
            await exportLogRef.update({ status: 'completed', completedAt: Date.now(), byteLength });

            // Küçük payload → inline dön
            if (byteLength <= INLINE_SIZE_LIMIT_BYTES) {
                return { format: 'inline', data: payload };
            }

            // Büyük payload → Storage'a yaz, signed URL dön
            const bucket = admin.storage().bucket();
            const filePath = `exports/${uid}/${Date.now()}_export.json`;
            const file = bucket.file(filePath);

            await file.save(jsonStr, {
                metadata: {
                    contentType: 'application/json',
                    metadata: {
                        uid,
                        exportedAt: new Date().toISOString(),
                    },
                },
            });

            const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + SIGNED_URL_TTL_MS,
            });

            functions.logger.info(`Büyük export Storage'a yazıldı: ${filePath}`);

            return {
                format: 'download',
                downloadUrl: signedUrl,
                expiresAt: new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString(),
                byteLength,
            };

        } catch (error) {
            await exportLogRef.update({ status: 'failed', error: String(error) }).catch(() => {});
            functions.logger.error('Veri ihraç hatası:', { error, uid });
            throw new functions.https.HttpsError(
                'internal',
                'Veri ihraç sırasında bir hata oluştu. Lütfen tekrar deneyin.',
            );
        }
    });

// ============================================================
// SANİTİZASYON HELPERS — Başka kullanıcı verisi sızmaması için
// Yalnızca beyaz-liste alanları döner (blacklist değil).
// ============================================================

interface MessageMetadataEntry {
    messageId: string;
    conversationId: string;
    timestamp: number;
    type: string;
}

interface SOSHistoryEntry {
    signalId: string;
    timestamp: number;
    status: string;
    type: string;
    trapped: boolean;
    hasLocation: boolean;
}

function toTimestampMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
    }
    if (typeof value === 'string') {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric < 1e11 ? Math.round(numeric * 1000) : Math.round(numeric);
        }
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value === 'object') {
        const timestamp = value as { toMillis?: () => number; seconds?: number };
        if (typeof timestamp.toMillis === 'function') {
            const millis = timestamp.toMillis();
            return Number.isFinite(millis) ? millis : 0;
        }
        if (typeof timestamp.seconds === 'number' && Number.isFinite(timestamp.seconds)) {
            return Math.round(timestamp.seconds * 1000);
        }
    }
    return 0;
}

function sanitizeUserProfile(data: FirebaseFirestore.DocumentData | undefined): Record<string, unknown> | null {
    if (!data) return null;
    return {
        displayName: typeof data.displayName === 'string' ? data.displayName : null,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : null,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
        language: typeof data.language === 'string' ? data.language : null,
        notificationsEnabled: typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : null,
        // E-posta Firebase Auth'tan alınır; Firestore profilinde tekrar etmemesi beklenir
        // ama varsa dahil et
        email: typeof data.email === 'string' ? data.email : null,
    };
}

function sanitizeDevice(data: FirebaseFirestore.DocumentData | undefined, deviceId: string): Record<string, unknown> {
    if (!data) return { deviceId };
    return {
        deviceId,
        platform: typeof data.platform === 'string' ? data.platform : null,
        lastUpdated: typeof data.lastUpdated === 'number' ? data.lastUpdated : null,
        // Token ve konum PII'dır; ihraç kapsamında meta düzeyinde dahil edilir
        hasLocation: Boolean(data.location),
        hasToken: Boolean(data.token || data.pushToken),
    };
}

function sanitizeHealthProfile(data: FirebaseFirestore.DocumentData | undefined): Record<string, unknown> | null {
    if (!data) return null;
    // Sağlık verisinin tamamı kullanıcının kendi verisidir — white-list ile dahil et
    return {
        bloodType: typeof data.bloodType === 'string' ? data.bloodType : null,
        allergies: Array.isArray(data.allergies) ? data.allergies : [],
        medications: Array.isArray(data.medications) ? data.medications : [],
        conditions: Array.isArray(data.conditions) ? data.conditions : [],
        chronicConditions: Array.isArray(data.chronicConditions) ? data.chronicConditions : [],
        emergencyContacts: Array.isArray(data.emergencyContacts) ? data.emergencyContacts : [],
        emergencyContact: typeof data.emergencyContact === 'object' && data.emergencyContact !== null
            ? {
                name: typeof data.emergencyContact.name === 'string' ? data.emergencyContact.name : null,
                // Telefon numarası PII — ihraç kapsamında dahil, zira kullanıcının kendi verisi
                phone: typeof data.emergencyContact.phone === 'string' ? data.emergencyContact.phone : null,
            }
            : null,
        notes: typeof data.notes === 'string' ? data.notes : null,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
    };
}

// ============================================================
// FAZ 1 TIER1-08 — ACCOUNT DELETION V3 FAMILY CLEANUP
// ============================================================
// KVKK Madde 7 (Right to be Forgotten) + GDPR Article 17 paralel uyum.
//
// AccountDeletionService.deleteAccount client-side 20 step iyi yapıyor ama
// 6 boşluk var:
//   - families/{id}/members/{uid} (v3 doc) NOT TOUCHED
//   - families.members array → uid NOT REMOVED
//   - users/{otherUid}/familyMembers/{uid} reverse links NOT DELETED
//   - sos_signals where deviceId == uid MISSED
//   - families/{id}/groupChat/messages where senderUid == uid NOT ANONYMIZED
//
// Bu CF auth.user().onDelete() trigger'ı ile çalışır:
//   - Client deleteUser(user) → auth token kaybeder → Firestore writes 'unauthenticated'
//     fail eder. Server-side admin SDK bypass'le bu yetim PII'yi temizler.
//   - Idempotency guard: deletion_audit_log check — auth trigger at-least-once.
//
// Anonymization vs delete:
//   - Group chat messages ANONYMIZE (sender → '[Silindi]', text → '[Bu mesaj
//     silindi]') — KVKK Madde 7 anonymization alternative, diğer üyelerin
//     "deprem öncesi konuşma" tarihi korunur.
//   - SOS/emergency mesajları HARD DELETE (acil aksiyon kapatıldı).

export const onUserDeletedCleanup = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .auth.user()
    .onDelete(async (user) => {
        const uid = user.uid;
        functions.logger.info(`[onUserDeletedCleanup] starting cleanup for uid=${uid}`);

        // Idempotency guard — at-least-once auth trigger
        try {
            const audit = await db.collection('deletion_audit_log')
                .where('uid', '==', uid)
                .where('triggeredBy', '==', 'auth.user().onDelete')
                .limit(1)
                .get();
            if (!audit.empty) {
                functions.logger.info(`[onUserDeletedCleanup] uid=${uid} already processed, skip`);
                return;
            }
        } catch (err) {
            functions.logger.warn(`[onUserDeletedCleanup] idempotency check failed (continuing):`, err);
        }

        // 1. Families that contain uid in their members array
        let familiesSnap: FirebaseFirestore.QuerySnapshot;
        try {
            familiesSnap = await db.collection('families')
                .where('members', 'array-contains', uid)
                .get();
        } catch (err) {
            functions.logger.error(`[onUserDeletedCleanup] families query failed:`, err);
            return;
        }

        functions.logger.info(`[onUserDeletedCleanup] uid=${uid} in ${familiesSnap.size} families`);

        // 1a. Remove uid from each family — member doc + array + delete-if-empty
        const familyMetadata: Array<{ familyRef: FirebaseFirestore.DocumentReference; otherMembers: string[]; groupId?: string }> = [];
        for (const f of familiesSnap.docs) {
            const data = f.data();
            const members: string[] = Array.isArray(data.members) ? data.members : [];
            const others = members.filter((m: string) => m !== uid);
            familyMetadata.push({
                familyRef: f.ref,
                otherMembers: others,
                groupId: typeof data.groupId === 'string' ? data.groupId : undefined,
            });

            try {
                const batch = db.batch();
                batch.delete(f.ref.collection('members').doc(uid));
                batch.update(f.ref, { members: admin.firestore.FieldValue.arrayRemove(uid) });
                if (others.length === 0) {
                    batch.delete(f.ref);
                }
                await batch.commit();
            } catch (err) {
                functions.logger.warn(`[onUserDeletedCleanup] family ${f.id} cleanup failed:`, err);
            }
        }

        // 2. Reverse links: users/{otherUid}/familyMembers/{uid}
        for (const meta of familyMetadata) {
            for (const otherUid of meta.otherMembers) {
                try {
                    await db.collection('users').doc(otherUid)
                        .collection('familyMembers').doc(uid).delete();
                } catch {
                    // doc may not exist — best effort
                }
            }
        }

        // 3. Outbound own familyMembers + familyIds subcollections
        try {
            const outbound = await db.collection('users').doc(uid)
                .collection('familyMembers').get();
            if (!outbound.empty) {
                const ob = db.batch();
                outbound.docs.forEach((d) => ob.delete(d.ref));
                await ob.commit();
            }
        } catch (err) {
            functions.logger.warn(`[onUserDeletedCleanup] outbound familyMembers cleanup failed:`, err);
        }

        try {
            const fids = await db.collection('users').doc(uid)
                .collection('familyIds').get();
            if (!fids.empty) {
                const fb = db.batch();
                fids.docs.forEach((d) => fb.delete(d.ref));
                await fb.commit();
            }
        } catch (err) {
            functions.logger.warn(`[onUserDeletedCleanup] familyIds cleanup failed:`, err);
        }

        // 4. Group chat messages — anonymize (preserve history for other members)
        for (const meta of familyMetadata) {
            if (!meta.groupId) continue;
            try {
                const msgsSnap = await db.collection('conversations').doc(meta.groupId)
                    .collection('messages').where('senderUid', '==', uid).get();
                if (msgsSnap.empty) continue;

                const mb = db.batch();
                for (const m of msgsSnap.docs) {
                    const d = m.data();
                    const isEmergency = d.type === 'sos' || d.type === 'emergency';
                    if (isEmergency) {
                        mb.delete(m.ref);
                    } else {
                        mb.update(m.ref, {
                            senderName: '[Silindi]',
                            senderUid: null,
                            text: '[Bu mesaj silindi]',
                            mediaUrl: null,
                            voiceUrl: null,
                            deletedAt: Date.now(),
                            deletedBySystem: true,
                        });
                    }
                }
                await mb.commit();
            } catch (err) {
                functions.logger.warn(`[onUserDeletedCleanup] groupChat ${meta.groupId} anonymize failed:`, err);
            }
        }

        // 5. SOS signals keyed by UID (deviceId field can match either)
        try {
            const sosSnap = await db.collection('sos_signals')
                .where('senderUid', '==', uid)
                .limit(500)
                .get();
            if (!sosSnap.empty) {
                const sb = db.batch();
                sosSnap.docs.forEach((d) => sb.delete(d.ref));
                await sb.commit();
            }
        } catch (err) {
            functions.logger.warn(`[onUserDeletedCleanup] sos_signals senderUid cleanup failed:`, err);
        }

        try {
            const sosBroadcastSnap = await db.collection('sos_broadcasts')
                .where('senderUid', '==', uid)
                .limit(500)
                .get();
            if (!sosBroadcastSnap.empty) {
                const sbb = db.batch();
                sosBroadcastSnap.docs.forEach((d) => sbb.delete(d.ref));
                await sbb.commit();
            }
        } catch (err) {
            functions.logger.warn(`[onUserDeletedCleanup] sos_broadcasts cleanup failed:`, err);
        }

        // 6. Audit log — KVKK Madde 7 compliance evidence + idempotency anchor
        try {
            await db.collection('deletion_audit_log').add({
                uid,
                deletedAt: Date.now(),
                triggeredBy: 'auth.user().onDelete',
                familiesCleanedUp: familyMetadata.length,
            });
        } catch (err) {
            functions.logger.error(`[onUserDeletedCleanup] audit log write failed:`, err);
        }

        functions.logger.info(`[onUserDeletedCleanup] complete for uid=${uid}`);
    });
