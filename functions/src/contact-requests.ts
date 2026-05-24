/**
 * AFETNET FIREBASE FUNCTIONS — CONTACT REQUESTS / OPAQUE INVITE MODULE
 *
 * FAZ 1 TIER1-03 — KVKK Madde 4/7/8 compliance: pre-consent PII disclosure fix.
 *
 * Önceki Flow (KVKK ihlali):
 *   - A scans B's QR → FirebaseFamilyOperations.ts:380 yazıyor
 *     users/{B}/familyMembers/{A} = { adderUid: A, adderName: A.displayName, ... }
 *   - B onay vermeden ÖNCE A'nın UID + displayName + photoURL B'nin namespace'inde
 *   - B okuduğunda A'nın PII'sini görür → KVKK Madde 8 (explicit consent ihlal)
 *
 * Yeni Flow (KVKK uyumlu):
 *   - A calls createContactInvite({ recipientUid, familyId? }) CF
 *     → CF writes contact_requests/{B}/incoming/{opaqueCode} = {
 *         opaqueCode, requestedAt, expiresAt
 *       } (NO PII)
 *     → CF writes invite_lookup/{opaqueCode} = {
 *         senderUid, recipientUid, familyId, createdAt
 *       } (admin-only, never client-readable)
 *   - B sees only opaque code in inbox — no PII visible
 *   - B taps "Kabul Et" → calls acceptContactRequest({ inviteCode }) CF
 *     → CF validates recipientUid == auth.uid + expiresAt > now
 *     → CF atomic batch:
 *       - users/{A}/familyMembers/{B} + users/{B}/familyMembers/{A} (PII first time visible)
 *       - families/{familyId}/members/{B} (if family)
 *       - consent_log/{uuid} (audit entry — KVKK Madde 11 compliance evidence)
 *     → CF deletes contact_requests/{B}/incoming/{code} + invite_lookup/{code}
 *     → Returns { success, senderName, senderUid } — B's client sees A's PII NOW
 *
 * Bu commit ADDITIVE — existing FirebaseFamilyOperations + ContactRequestService
 * akışı bozulmaz. Phase 2 sprint'te client opaque flow'a geçer + eski path
 * yasaklanır (forced-update gerek).
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { db, REGION } from './utils';

// ============================================================
// SABİTLER
// ============================================================

/** Opaque invite code — 48 karakter base64url (288 bit entropy) */
const OPAQUE_CODE_BYTES = 36; // 36 * 4/3 = 48 base64 chars
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

/** Saatte bir kullanıcı maksimum kaç davetiye gönderebilir (spam koruması) */
const MAX_INVITES_PER_HOUR = 30;

/** generateOpaqueCode — cryptographically random URL-safe identifier */
function generateOpaqueCode(): string {
    return crypto.randomBytes(OPAQUE_CODE_BYTES).toString('base64url');
}

// ============================================================
// CREATE CONTACT INVITE
// ============================================================

interface CreateInvitePayload {
    recipientUid: string;
    familyId?: string;
}

interface CreateInviteResult {
    success: boolean;
    opaqueCode: string;
    expiresAt: number;
}

export const createContactInvite = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: CreateInvitePayload, context): Promise<CreateInviteResult> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Bu işlem için giriş yapmanız gerekmektedir.',
            );
        }

        const senderUid = context.auth.uid;
        const recipientUid = String(data?.recipientUid || '').trim();
        const familyId = data?.familyId ? String(data.familyId).trim() : undefined;

        if (!recipientUid || recipientUid.length < 8 || recipientUid.length > 128) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Geçersiz alıcı kullanıcı kimliği.',
            );
        }
        if (recipientUid === senderUid) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Kendinize davetiye gönderemezsiniz.',
            );
        }

        // Rate limit — son 1 saatte gönderilen davetiye sayısı
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        try {
            const recentSnap = await db.collection('invite_lookup')
                .where('senderUid', '==', senderUid)
                .where('createdAt', '>=', oneHourAgo)
                .limit(MAX_INVITES_PER_HOUR + 1)
                .get();
            if (recentSnap.size >= MAX_INVITES_PER_HOUR) {
                throw new functions.https.HttpsError(
                    'resource-exhausted',
                    `Saatlik davetiye sınırına ulaştınız (${MAX_INVITES_PER_HOUR}/saat).`,
                );
            }
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            functions.logger.warn('[createContactInvite] rate limit check failed (continuing):', err);
        }

        // Dedup — aynı sender+recipient için açık invite varsa onu döndür
        try {
            const existingSnap = await db.collection('invite_lookup')
                .where('senderUid', '==', senderUid)
                .where('recipientUid', '==', recipientUid)
                .where('expiresAt', '>', now)
                .limit(1)
                .get();
            if (!existingSnap.empty) {
                const existing = existingSnap.docs[0];
                return {
                    success: true,
                    opaqueCode: existing.id,
                    expiresAt: existing.data().expiresAt,
                };
            }
        } catch (err) {
            functions.logger.warn('[createContactInvite] dedup check failed (continuing):', err);
        }

        // Üret + yaz
        const opaqueCode = generateOpaqueCode();
        const expiresAt = now + INVITE_TTL_MS;

        try {
            const batch = db.batch();
            // 1. Recipient inbox — NO PII
            batch.set(
                db.collection('contact_requests').doc(recipientUid)
                    .collection('incoming').doc(opaqueCode),
                {
                    opaqueCode,
                    requestedAt: now,
                    expiresAt,
                },
            );
            // 2. Admin-only lookup — full context
            batch.set(
                db.collection('invite_lookup').doc(opaqueCode),
                {
                    senderUid,
                    recipientUid,
                    familyId: familyId ?? null,
                    createdAt: now,
                    expiresAt,
                },
            );
            await batch.commit();
        } catch (err) {
            functions.logger.error('[createContactInvite] write failed:', err);
            throw new functions.https.HttpsError(
                'internal',
                'Davetiye oluşturulamadı. Lütfen tekrar deneyin.',
            );
        }

        functions.logger.info(
            `[createContactInvite] sender=${senderUid.substring(0, 8)} recipient=${recipientUid.substring(0, 8)} code=${opaqueCode.substring(0, 8)}`,
        );

        return { success: true, opaqueCode, expiresAt };
    });

// ============================================================
// ACCEPT CONTACT INVITE
// ============================================================

interface AcceptInvitePayload {
    inviteCode: string;
}

interface AcceptInviteResult {
    success: boolean;
    senderUid: string;
    senderName: string;
    familyId: string | null;
}

export const acceptContactRequest = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: AcceptInvitePayload, context): Promise<AcceptInviteResult> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Bu işlem için giriş yapmanız gerekmektedir.',
            );
        }

        const recipientUid = context.auth.uid;
        const inviteCode = String(data?.inviteCode || '').trim();

        if (!inviteCode || inviteCode.length < 32 || inviteCode.length > 64) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Geçersiz davetiye kodu.',
            );
        }

        // 1. Lookup — admin-only collection
        const lookupRef = db.collection('invite_lookup').doc(inviteCode);
        const lookupSnap = await lookupRef.get();
        if (!lookupSnap.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Davetiye bulunamadı veya süresi dolmuş.',
            );
        }

        const lookup = lookupSnap.data() as {
            senderUid: string;
            recipientUid: string;
            familyId: string | null;
            createdAt: number;
            expiresAt: number;
        };

        if (lookup.recipientUid !== recipientUid) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Bu davetiye size ait değil.',
            );
        }
        if (lookup.expiresAt <= Date.now()) {
            // Expire et — temizlik için
            try {
                await Promise.all([
                    lookupRef.delete(),
                    db.collection('contact_requests').doc(recipientUid)
                        .collection('incoming').doc(inviteCode).delete(),
                ]);
            } catch { /* best effort */ }
            throw new functions.https.HttpsError(
                'deadline-exceeded',
                'Davetiyenin süresi dolmuş.',
            );
        }

        // 2. Sender'ın hâlâ var olduğunu doğrula
        let senderName = '';
        let senderPhotoURL: string | null = null;
        try {
            const senderUserSnap = await db.collection('users').doc(lookup.senderUid).get();
            if (!senderUserSnap.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Davet eden kullanıcı bulunamadı (hesap silinmiş olabilir).',
                );
            }
            const senderData = senderUserSnap.data() as {
                displayName?: string;
                photoURL?: string;
                name?: string;
            };
            senderName = String(senderData?.displayName || senderData?.name || '').trim();
            senderPhotoURL = senderData?.photoURL ? String(senderData.photoURL) : null;
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            functions.logger.warn('[acceptContactRequest] sender lookup failed:', err);
        }

        const now = Date.now();
        const consentLogId = db.collection('consent_log').doc().id;

        // 3. Atomic batch — KVKK Madde 8 explicit consent moment
        try {
            const batch = db.batch();

            // 3a. Recipient → Sender bond (B's namespace now has A's PII — FIRST TIME)
            batch.set(
                db.collection('users').doc(recipientUid)
                    .collection('familyMembers').doc(lookup.senderUid),
                {
                    uid: lookup.senderUid,
                    name: senderName,
                    photoURL: senderPhotoURL,
                    approvalState: 'mutual',
                    addedAt: now,
                    addedVia: 'opaque_invite',
                    inviteCode,
                    familyId: lookup.familyId,
                },
                { merge: true },
            );

            // 3b. Sender → Recipient bond
            batch.set(
                db.collection('users').doc(lookup.senderUid)
                    .collection('familyMembers').doc(recipientUid),
                {
                    uid: recipientUid,
                    approvalState: 'mutual',
                    acceptedAt: now,
                    inviteCode,
                    familyId: lookup.familyId,
                },
                { merge: true },
            );

            // 3c. Family membership (eğer invite bir family bağlamındaysa)
            if (lookup.familyId) {
                batch.set(
                    db.collection('families').doc(lookup.familyId)
                        .collection('members').doc(recipientUid),
                    {
                        uid: recipientUid,
                        joinedAt: now,
                        status: 'active',
                        via: 'opaque_invite',
                    },
                    { merge: true },
                );
                batch.update(
                    db.collection('families').doc(lookup.familyId),
                    { members: admin.firestore.FieldValue.arrayUnion(recipientUid) },
                );
            }

            // 3d. Consent log — KVKK Madde 11 audit trail
            batch.set(
                db.collection('consent_log').doc(consentLogId),
                {
                    type: 'family_invite_accepted',
                    senderUid: lookup.senderUid,
                    recipientUid,
                    inviteCode,
                    familyId: lookup.familyId,
                    consentedAt: now,
                    consentVersion: 'v1',
                },
            );

            // 3e. Inbox + lookup temizliği (tek kullanımlık)
            batch.delete(
                db.collection('contact_requests').doc(recipientUid)
                    .collection('incoming').doc(inviteCode),
            );
            batch.delete(lookupRef);

            await batch.commit();
        } catch (err) {
            functions.logger.error('[acceptContactRequest] batch commit failed:', err);
            throw new functions.https.HttpsError(
                'internal',
                'Davetiye kabul edilemedi. Lütfen tekrar deneyin.',
            );
        }

        functions.logger.info(
            `[acceptContactRequest] sender=${lookup.senderUid.substring(0, 8)} recipient=${recipientUid.substring(0, 8)} family=${lookup.familyId || 'none'}`,
        );

        return {
            success: true,
            senderUid: lookup.senderUid,
            senderName,
            familyId: lookup.familyId,
        };
    });
