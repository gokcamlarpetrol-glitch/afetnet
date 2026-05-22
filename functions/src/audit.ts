import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export const auditFirestore = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        // SECURITY: Admin-only function — contains sensitive user data
        if (!context.auth?.token?.admin) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only');
        }
        if (process.env.ENABLE_FIRESTORE_AUDIT !== 'true') {
            throw new functions.https.HttpsError('failed-precondition', 'Firestore audit is disabled');
        }

        const db = admin.firestore();
        const result: Record<string, Array<{ id: string; [key: string]: unknown }>> = {};

        try {
            const convSnap = await db.collection('conversations').limit(5).get();
            result.conversations = convSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const msgSnap = await db.collectionGroup('messages').limit(5).get();
            result.messages = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const inboxSnap = await db.collectionGroup('threads').limit(5).get();
            result.user_inbox = inboxSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const locSnap = await db.collection('locations_current').limit(5).get();
            result.locations_current = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Görev #24 — yalnızca hassas olmayan alanları döndür; token/pushToken/credential
            // alanlarını sızdırma. privacy.ts:sanitizeDevice deseninin yansıması.
            const tokenSnap = await db.collectionGroup('devices').limit(5).get();
            result.push_tokens = tokenSnap.docs.map(d => {
                const raw = d.data();
                return {
                    id: d.id,
                    platform: typeof raw.platform === 'string' ? raw.platform : null,
                    lastUpdated: typeof raw.lastUpdated === 'number' ? raw.lastUpdated : null,
                    hasLocation: Boolean(raw.location),
                    hasToken: Boolean(raw.token || raw.pushToken),
                    ownerUid: typeof raw.ownerUid === 'string' ? raw.ownerUid : null,
                    // token, pushToken, fcmToken, credential alanları kasıtlı olarak çıkarıldı
                };
            });

            return { success: true, data: result };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    });
