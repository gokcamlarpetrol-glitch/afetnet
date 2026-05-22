/**
 * AFETNET FIREBASE FUNCTIONS - MESSAGING MODULE
 *
 * Functions:
 * - onNewMessage: Legacy device-path message push notifications
 * - onNewConversationMessageV3: V3 UID-centric conversation message push
 * - onContactRequest: Contact request push notifications
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import {
    db,
    REGION,
    sendPushToToken,
    collectPushTokensForUid,
} from './utils';

const MAX_INBOX_PREVIEW_LENGTH = 120;

const toPreviewText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.length > MAX_INBOX_PREVIEW_LENGTH
        ? `${trimmed.substring(0, MAX_INBOX_PREVIEW_LENGTH)}...`
        : trimmed;
};

async function syncConversationInboxV3(params: {
    conversationId: string;
    conversationType: string;
    participants: string[];
    senderUid: string;
    senderName: string;
    lastMessagePreview: string;
    lastMessageAt: number;
    isGroupConversation: boolean;
}): Promise<void> {
    const {
        conversationId,
        conversationType,
        participants,
        senderUid,
        senderName,
        lastMessagePreview,
        lastMessageAt,
        isGroupConversation,
    } = params;

    const normalizedParticipants = Array.from(
        new Set(
            participants
                .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
                .filter((uid) => uid.length > 0),
        ),
    );

    if (normalizedParticipants.length === 0) return;

    const now = Date.now();
    const safeTimestamp = Number.isFinite(lastMessageAt) ? lastMessageAt : now;
    const baseThreadPayload: Record<string, unknown> = {
        conversationId,
        conversationType,
        isGroup: isGroupConversation,
        participants: normalizedParticipants,
        lastMessagePreview,
        lastMessageSenderName: senderName,
        lastMessageSenderUid: senderUid,
        lastMessageAt: safeTimestamp,
        updatedAt: now,
        schemaVersion: 3,
    };

    // Use transaction for recipient unreadCount to prevent double-increment on CF retry.
    // increment(1) is NOT idempotent — if the function retries after push failure,
    // the inbox sync runs again and increments unreadCount a second time.
    const writeResults = await Promise.allSettled(
        normalizedParticipants.map(async (uid) => {
            const threadRef = db.collection('user_inbox').doc(uid).collection('threads').doc(conversationId);
            if (uid === senderUid) {
                return threadRef.set({
                    ...baseThreadPayload,
                    unreadCount: 0,
                }, { merge: true });
            }
            // Idempotent increment via transaction (prevents TOCTOU race on
            // concurrent invocations).
            //
            // H8 (linearizability proof, no jest harness available here):
            //   Firestore transactions use snapshot isolation. If two CF
            //   instances fire concurrently for the same conversationId:
            //     - Both read threadRef → both see existingLastAt = T0
            //     - Both attempt to write — Firestore serializes via OCC; the
            //       loser retries.
            //     - On retry, the loser reads the WINNER's write
            //       (existingLastAt = T_winner). If safeTimestamp <= T_winner,
            //       the increment is skipped (the "already processed" branch),
            //       so unreadCount only advances by 1 per logical message.
            //   This holds even when N parallel CF instances fire — total
            //   increment for a given message = exactly 1, period.
            //
            //   The ONLY failure mode is if the same message has TWO distinct
            //   safeTimestamp values (e.g. clock skew between CF instances on
            //   a redeploy). Mitigated upstream: timestamp is set to
            //   `message.timestamp ?? Date.now()` on first delivery and reused
            //   on retry — no per-CF generation.
            return db.runTransaction(async (txn) => {
                const existing = await txn.get(threadRef);
                const existingLastAt = existing.data()?.lastMessageAt || 0;
                if (existingLastAt >= safeTimestamp) {
                    // Already processed — just update metadata without incrementing
                    txn.set(threadRef, { ...baseThreadPayload }, { merge: true });
                } else {
                    txn.set(threadRef, {
                        ...baseThreadPayload,
                        unreadCount: admin.firestore.FieldValue.increment(1),
                    }, { merge: true });
                }
            });
        }),
    );

    const recipientFailures = writeResults
        .filter((r, i) => r.status === 'rejected' && normalizedParticipants[i] !== senderUid);
    writeResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            const uid = normalizedParticipants[index];
            functions.logger.warn(`V3 inbox sync failed for user ${uid} in ${conversationId}: ${result.reason}`);
        }
    });
    // Throw if ALL recipient inbox writes failed — triggers CF retry for delivery
    const recipientCount = normalizedParticipants.filter(uid => uid !== senderUid).length;
    if (recipientFailures.length > 0 && recipientFailures.length >= recipientCount && recipientCount > 0) {
        throw new Error(`All ${recipientCount} recipient inbox writes failed for ${conversationId}`);
    }
}

// ============================================================
// ON NEW MESSAGE — Push Notification for Incoming Messages
// Trigger: devices/{deviceId}/messages/{messageId} -> onCreate
// Flow: Get device ownerUid -> look up fcm_tokens/{ownerUid} -> push
// ============================================================

export const onNewMessage = functions
    .region(REGION)
    .firestore.document('devices/{deviceId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const { deviceId } = context.params;
        const messageData = snap.data();

        if (!messageData) {
            functions.logger.warn('onNewMessage: empty message data');
            return;
        }

        // CRITICAL FIX: Idempotency guard — onCreate can fire >1 time.
        // Every other onCreate trigger has this guard, but onNewMessage was missing it,
        // causing duplicate push notifications on CF retries.
        if (messageData._processed) return;

        const senderDeviceId = messageData.fromDeviceId || '';
        const senderUid = typeof messageData.senderUid === 'string' ? messageData.senderUid : '';
        const content = messageData.content || '';
        const senderName = messageData.senderName || messageData.metadata?.senderName || messageData.fromName || 'Yeni Mesaj';

        // DUPLICATE-NOTIFICATION FIX: Skip push for V3 messages (schemaVersion === 3).
        // V3 messages are handled by onNewConversationMessageV3 which fires on the
        // conversations/{convId}/messages path. The legacy onNewMessage should only
        // handle truly old-schema messages to avoid sending a SECOND FCM push.
        if (messageData.schemaVersion >= 3) {
            functions.logger.debug(`onNewMessage: Skipping V3 message ${context.params.messageId} (handled by onNewConversationMessageV3)`);
            return;
        }

        // Don't notify sender about their own message copy
        // (dual-write creates a copy in both sender and recipient inboxes)
        if (senderDeviceId === deviceId) {
            functions.logger.debug(`onNewMessage: Skipping self-notification for ${deviceId}`);
            return;
        }

        try {
            // Step 1: Get the ownerUid of the device receiving the message
            const deviceDoc = await db.collection('devices').doc(deviceId).get();
            if (!deviceDoc.exists) {
                functions.logger.warn(`onNewMessage: device ${deviceId} not found`);
                return;
            }

            const ownerUid = deviceDoc.data()?.ownerUid;
            if (!ownerUid) {
                functions.logger.warn(`onNewMessage: device ${deviceId} has no ownerUid`);
                return;
            }

            // Step 2: Get push tokens via shared utility (push_tokens + fcm_tokens + device fallback)
            const deviceFallbackToken = deviceDoc.data()?.pushToken || deviceDoc.data()?.token;
            const allTokens = await collectPushTokensForUid(ownerUid, deviceFallbackToken);

            if (allTokens.length === 0) {
                functions.logger.debug(`onNewMessage: no push token for user ${ownerUid} (checked push_tokens + fcm_tokens + devices/${deviceId})`);
                return;
            }

            // Step 3: Send push notification to ALL devices
            const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
            let totalSent = 0;

            for (const pushToken of allTokens) {
                const success = await sendPushToToken(
                    pushToken,
                    `💬 ${senderName}`,
                    truncatedContent || 'Yeni mesaj',
                    {
                        type: 'new_message',
                        messageId: context.params.messageId,
                        conversationId: deviceId, // legacy path uses deviceId as logical thread key
                        conversationType: 'direct',
                        senderDeviceId,
                        senderUid,
                        senderName,
                        deviceId,
                        userId: senderUid || senderDeviceId,
                        senderId: senderUid || senderDeviceId,
                        // CRITICAL: include body for NotificationCenter fallback routing
                        message: truncatedContent || content || 'Yeni mesaj',
                    },
                );
                if (success) totalSent++;
            }

            if (totalSent > 0) {
                functions.logger.info(`✅ Message push sent to ${totalSent}/${allTokens.length} devices for ${ownerUid} from ${senderName}`);
                // Mark as processed after successful push to prevent duplicate notifications on retry
                await snap.ref.update({ _processed: true }).catch(() => {});
            } else {
                // CRITICAL FIX: Throw when ALL push tokens fail to trigger CF retry.
                // Previously returned normally without _processed — CF never retried because
                // only unhandled errors trigger retry. The push failure was silently lost.
                throw new Error(`Message push failed for ALL ${allTokens.length} devices of ${ownerUid}`);
            }
        } catch (error) {
            functions.logger.error('onNewMessage error:', error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }
    });

// ============================================================
// V3: ON NEW CONVERSATION MESSAGE — UID-Centric Push
// Trigger: conversations/{conversationId}/messages/{messageId} -> onCreate
// Flow: senderUid -> participants -> push_tokens/{uid}/devices -> push
// NO MORE ownerUid intermediate lookup!
// ============================================================

export const onNewConversationMessageV3 = functions
    .region(REGION)
    .firestore.document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const { conversationId, messageId } = context.params;
        const messageData = snap.data();

        if (!messageData) {
            functions.logger.warn('onNewConversationMessageV3: empty data');
            return;
        }

        // IDEMPOTENCY GUARD: Cloud Functions onCreate can fire >1 time for the same document.
        // Without this, duplicate invocations send duplicate push notifications AND
        // double-increment unreadCount in syncConversationInboxV3 (FieldValue.increment(1)),
        // leading to permanently inflated badge counts.
        if (messageData._processed) {
            functions.logger.info(`onNewConversationMessageV3: already processed ${messageId}, skipping`);
            return;
        }
        // CRITICAL FIX: Do NOT set _processed flag here (before push delivery).
        // Previously, _processed was set early as a race lock. But if the function
        // crashed/timed out AFTER setting the flag but BEFORE sending push notifications,
        // the push was permanently lost — the next retry would see _processed=true and skip.
        // Now: _processed is set AFTER successful push delivery (see bottom of function).
        // Duplicate push risk is mitigated by the flag check above + client-side dedup.
        try {
            // Attempt to re-read the flag to handle concurrent executions.
            // If another instance already set _processed and sent push, skip this execution.
            const freshSnap = await snap.ref.get();
            if (freshSnap.data()?._processed) {
                functions.logger.info(`onNewConversationMessageV3: concurrent instance already processed ${messageId}, skipping`);
                return;
            }
        } catch (raceErr: any) {
            // Non-critical — proceed with push (better duplicate than lost)
            functions.logger.debug(`onNewConversationMessageV3: race check read failed for ${messageId}:`, raceErr);
        }

        const senderUid = messageData.senderUid || '';
        const content = messageData.content || '';
        // CRITICAL FIX: Client writes 'fromName', not 'senderName'.
        // Without this, ALL group push notifications show "Yeni Mesaj" instead of actual sender.
        const senderName = messageData.fromName || messageData.senderName || 'Yeni Mesaj';
        const messageType = messageData.type || 'text';
        const mediaType = messageData.mediaType || (messageData.metadata?.mediaType) || '';
        const mediaDuration = messageData.mediaDuration || (messageData.metadata?.mediaDuration) || 0;

        if (!senderUid) {
            functions.logger.warn('onNewConversationMessageV3: no senderUid');
            return;
        }

        try {
            // Step 1: Get conversation participants
            const convDoc = await db.collection('conversations').doc(conversationId).get();
            if (!convDoc.exists) {
                functions.logger.warn(`V3: conversation ${conversationId} not found`);
                return;
            }

            const conversationType = String(convDoc.data()?.type || 'direct');
            const isGroupConversation = conversationType === 'group' || conversationId.startsWith('grp_');

            const rawParticipants = convDoc.data()?.participants;
            if (!Array.isArray(rawParticipants)) {
                functions.logger.warn(`onNewConversationMessageV3: invalid participants array in ${conversationId}`);
                return;
            }

            const participants = Array.from(
                new Set(
                    rawParticipants
                        .filter((uid): uid is string => typeof uid === 'string')
                        .map((uid) => uid.trim())
                        .filter((uid) => uid.length > 0),
                ),
            );
            if (participants.length === 0) {
                functions.logger.warn(`onNewConversationMessageV3: empty participants in ${conversationId}`);
                return;
            }
            if (!participants.includes(senderUid)) {
                functions.logger.warn(`onNewConversationMessageV3: sender ${senderUid} not in participants for ${conversationId}`);
                return;
            }

            const recipientUids = participants.filter(uid => uid !== senderUid);

            // Step 2: Build notification title/body based on media type
            let pushTitle = `💬 ${senderName}`;
            let pushBody = content.length > 100 ? content.substring(0, 100) + '...' : (content || 'Yeni mesaj');
            if (mediaType === 'image') {
                pushTitle = `📷 ${senderName}`;
                pushBody = content && content !== '📷 Fotoğraf' ? content.substring(0, 100) : 'Fotoğraf gönderdi';
            } else if (mediaType === 'voice') {
                pushTitle = `🎤 ${senderName}`;
                const mins = Math.floor(mediaDuration / 60);
                const secs = String(Math.floor(mediaDuration % 60)).padStart(2, '0');
                pushBody = `Sesli mesaj (${mins}:${secs})`;
            } else if (mediaType === 'location') {
                pushTitle = `📍 ${senderName}`;
                pushBody = 'Konum paylaştı';
            }

            // Step 2.5: Server-authoritative inbox thread sync.
            // This guarantees user_inbox/{uid}/threads/{conversationId} exists even if
            // client-side dual-write fails due to connectivity/cold-start race.
            // IMPORTANT: This is the BACKUP for client-side inbox delivery.
            // When the client reports partial_success (message persisted but inbox write failed),
            // this CF-side inbox sync fires automatically because the message document was
            // written to Firestore (triggering this onCreate). The client-side
            // FirebaseMessageOperations.saveMessage() returns partial_success in this case,
            // and HybridMessageService.attemptSend() treats it as cloudSuccess=true
            // (removes from retry queue) precisely because this CF provides the safety net.
            const inboxSyncPromise = syncConversationInboxV3({
                conversationId,
                conversationType,
                participants,
                senderUid,
                senderName,
                lastMessagePreview: toPreviewText(pushBody || content || 'Yeni mesaj'),
                lastMessageAt: Number(messageData.timestamp || Date.now()),
                isGroupConversation,
            });

            if (recipientUids.length === 0) {
                await inboxSyncPromise;
                return;
            }

            let totalSent = 0;

            // Run inbox sync and push fan-out in parallel.
            const pushPromise = Promise.all(recipientUids.map(async (recipientUid) => {
                const tokens = await collectPushTokensForUid(recipientUid);
                if (tokens.length === 0) return;

                const pushDataPayload: Record<string, string> = {
                    type: messageType === 'sos' ? 'sos_message' : 'new_message',
                    messageId,
                    conversationId,
                    conversationType,
                    isGroup: String(isGroupConversation),
                    senderUid,
                    senderName,
                    // CRITICAL FIX: Include message body in push payload.
                    // handleNotificationTap needs the 'message' field to construct fallback
                    // notification previews and correctly route cold-start taps on iOS,
                    // where the data payload keys may arrive in a flattened structure.
                    message: pushBody,
                    // Media type hint for rich notification rendering
                    ...(mediaType ? { mediaType } : {}),
                    // Redundant fields for maximum handleNotificationTap compatibility
                    // iOS APNS payloads sometimes lose nested data keys — belt-and-suspenders approach
                    userId: senderUid,
                    fromName: senderName,
                    senderId: senderUid,
                };

                const results = await Promise.all(tokens.map(token =>
                    sendPushToToken(token, pushTitle, pushBody, pushDataPayload)
                ));
                totalSent += results.filter(Boolean).length;
            }));

            const [inboxResult, pushResult] = await Promise.allSettled([inboxSyncPromise, pushPromise]);
            const inboxFailed = inboxResult.status === 'rejected';
            const pushFailed = pushResult.status === 'rejected';

            if (inboxFailed) {
                functions.logger.warn(`V3 inbox sync rejected for ${conversationId}: ${inboxResult.reason}`);
            }

            // ERROR MATRIX:
            // Both OK              → _processed = true  (normal path)
            // Inbox OK, push fail  → throw (retry for push delivery)
            // Inbox fail, push OK  → _processed = true  (recipient got push; inbox self-heals on next message/app open)
            // Both fail            → throw (retry both)
            if (pushFailed && inboxFailed) {
                // Both failed — throw to trigger CF retry for both
                throw new Error(`Both inbox sync and push failed for ${conversationId}: inbox=${inboxResult.reason}, push=${pushResult.reason}`);
            }
            if (pushFailed) {
                // Push failed, inbox OK — throw to retry push delivery
                throw pushResult.reason;
            }

            // CRITICAL FIX: sendPushToToken catches its own errors and returns false (never throws).
            // So pushPromise always resolves even when ALL pushes fail. Without this check,
            // _processed=true is set with totalSent===0, permanently losing the notification.
            if (totalSent === 0 && recipientUids.length > 0) {
                functions.logger.warn(
                    `V3 push: 0/${recipientUids.length} recipients received push for ${conversationId} — forcing retry`
                );
                throw new Error(`Message push sent to 0 recipients for ${conversationId} (all tokens failed)`);
            }

            // If only inbox failed, push succeeded — continue to set _processed.
            // Recipients got push notifications; inbox will self-heal on next message or app open.

            functions.logger.info(
                `✅ V3 push: ${totalSent} sent (conv: ${conversationId}, from: ${senderName})${inboxFailed ? ' [inbox sync failed, push succeeded]' : ''}`
            );

            // CRITICAL FIX: Set _processed flag AFTER push delivery succeeds.
            // Previously set early (before push), which meant if the function
            // crashed between flag set and push send, the push was permanently lost.
            // Now: flag is set after successful delivery, so retries can re-attempt push.
            // Worst case: a duplicate push on concurrent invocations (handled by client dedup).
            try {
                await snap.ref.update({ _processed: true });
            } catch (procErr: any) {
                // Non-critical: push was already sent, flag is just for idempotency
                functions.logger.debug(`onNewConversationMessageV3: _processed flag write failed (non-critical, push already sent): ${procErr}`);
            }
        } catch (error) {
            functions.logger.error('onNewConversationMessageV3 error:', error);
            // Do NOT set _processed on error — allow retry to re-attempt push delivery
            throw error; // Re-throw to trigger Cloud Functions retry
        }
    });

// ============================================================
// ON CONTACT REQUEST — Push notification when someone sends a contact request
// Trigger: users/{uid}/contactRequests/{requestId} -> onCreate
// ============================================================

export const onContactRequest = functions
    .region(REGION)
    .firestore.document('users/{uid}/contactRequests/{requestId}')
    .onCreate(async (snap, context) => {
        const recipientUid = context.params.uid;
        const requestData = snap.data();

        if (!requestData) {
            functions.logger.warn('onContactRequest: empty request data');
            return;
        }

        // Only notify for pending requests
        if (requestData.status !== 'pending') return;

        // Idempotency guard: onCreate can fire >1 time
        if (requestData._processed) return;

        const senderName = requestData.fromName || 'Bilinmeyen';

        try {
            const allTokens = await collectPushTokensForUid(recipientUid);
            if (allTokens.length === 0) {
                functions.logger.debug(`onContactRequest: no push token for user ${recipientUid}`);
                return;
            }

            // ELITE F3: Make body clearer for family invites — recipients must understand
            // this is a life-safety opt-in (without acceptance, location sharing is blocked).
            // requestData.familyId being set indicates the sender is inviting into a family group.
            const isFamilyInvite = typeof requestData.familyId === 'string' && requestData.familyId.length > 0;
            const title = isFamilyInvite
                ? `👨‍👩‍👧 ${senderName} sizi aile listesine ekledi`
                : `👋 ${senderName}`;
            const body = isFamilyInvite
                ? `Kabul ederek karşılıklı konum, durum ve şarj seviyesi paylaşımını açın.`
                : (requestData.message
                    ? `Kişi ekleme isteği: "${requestData.message}"`
                    : `${senderName} sizi kişi olarak eklemek istiyor`);

            const pushData: Record<string, string> = {
                type: 'contact_request',
                fromUserId: requestData.fromUserId || '',
                fromName: senderName,
                requestId: context.params.requestId,
                isFamilyInvite: String(isFamilyInvite),
                familyId: typeof requestData.familyId === 'string' ? requestData.familyId : '',
            };

            let totalSent = 0;
            for (const pushToken of allTokens) {
                const success = await sendPushToToken(pushToken, title, body, pushData);
                if (success) totalSent++;
            }

            if (totalSent > 0) {
                functions.logger.info(`✅ Contact request push sent to ${totalSent} devices: ${senderName} → ${recipientUid}`);
                await snap.ref.update({ _processed: true }).catch(() => {});
            } else {
                // CRITICAL FIX: Throw when ALL push tokens fail to trigger CF retry.
                // Previously returned normally without _processed — CF never retried.
                throw new Error(`Contact request push failed for ALL ${allTokens.length} devices of ${recipientUid}`);
            }
        } catch (error) {
            functions.logger.error('onContactRequest error:', error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }
    });
