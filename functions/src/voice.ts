/**
 * AFETNET FIREBASE FUNCTIONS - VOICE CALL MODULE
 *
 * Functions:
 * - onIncomingVoiceCall: Firestore trigger for incoming voice calls
 * - sendCallNotification: Callable function for direct call notifications
 */

import * as functions from 'firebase-functions/v1';

import * as admin from 'firebase-admin';
import {
    REGION,
    sendPushToToken,
    collectPushTokensForUid,
    isLikelyFirebaseUid,
} from './utils';

// ============================================================
// VOICE CALL NOTIFICATION — Push notification for incoming voice calls
// Trigger: voice_calls_incoming/{recipientUid} -> onWrite
// CRITICAL FIX: Was onCreate, but client uses setDoc (create-or-update) on a single
// document per user. After first call, doc already exists → setDoc triggers onUpdate
// not onCreate → push notification NEVER sent for subsequent calls.
// ============================================================

export const onIncomingVoiceCall = functions
    .region(REGION)
    .firestore.document('voice_calls_incoming/{recipientUid}')
    .onWrite(async (change, context) => {
        // Only process creates and updates (not deletes)
        if (!change.after.exists) return;
        const snap = change.after;
        const recipientUid = context.params.recipientUid;
        const callData = snap.data()!;

        const callerName = typeof callData.callerName === 'string' ? callData.callerName : 'Bilinmeyen';
        const callerUid = typeof callData.callerUid === 'string' ? callData.callerUid : '';
        const callId = typeof callData.callId === 'string' ? callData.callId : '';

        if (!callId) {
            functions.logger.warn('onIncomingVoiceCall: no callId');
            return;
        }

        // FIX: Validate callerUid to prevent push with empty/invalid sender
        if (!callerUid || !isLikelyFirebaseUid(callerUid)) {
            functions.logger.warn(`onIncomingVoiceCall: invalid callerUid: ${callerUid}`);
            return;
        }

        // Idempotency guard: onCreate can fire >1 time
        if (callData._processed) return;

        try {
            const allTokens = await collectPushTokensForUid(recipientUid);
            if (allTokens.length === 0) {
                functions.logger.warn(`onIncomingVoiceCall: no push tokens for ${recipientUid}`);
                return;
            }

            let totalSent = 0;
            for (const token of allTokens) {
                const success = await sendPushToToken(
                    token,
                    `📞 ${callerName}`,
                    `${callerName} sizi arıyor...`,
                    {
                        type: 'voice_call',
                        callId,
                        callerUid,
                        callerName,
                    },
                );
                if (success) totalSent++;
            }

            // CRITICAL FIX: Only mark as processed when at least one push succeeded.
            // Previously set _processed unconditionally — if all tokens failed (e.g., all
            // expired), the voice call notification was permanently lost on CF retry.
            if (totalSent > 0) {
                await snap.ref.update({ _processed: true }).catch(() => {});
                functions.logger.info(`✅ Voice call push: ${totalSent} sent to ${recipientUid} from ${callerName}`);
            } else {
                // CRITICAL FIX: Throw when ALL push tokens fail to trigger CF retry.
                // Previously returned normally — CF never retried, voice call notification was lost.
                throw new Error(`Voice call push failed for ALL ${allTokens.length} tokens of ${recipientUid}`);
            }
        } catch (error) {
            functions.logger.error('onIncomingVoiceCall error:', error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }
    });

// ============================================================
// CALLABLE: sendCallNotification — Direct call notification
// Used by VoiceCallService when Firestore trigger isn't fast enough
// ============================================================

export const sendCallNotification = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const callId = typeof data?.callId === 'string' ? data.callId.trim() : '';
        const recipientUid = typeof data?.recipientUid === 'string' ? data.recipientUid.trim() : '';
        const callerName = typeof data?.callerName === 'string' ? data.callerName : '';

        if (!recipientUid || !callId) {
            throw new functions.https.HttpsError('invalid-argument', 'recipientUid and callId required');
        }
        if (!isLikelyFirebaseUid(recipientUid)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid recipientUid');
        }
        if (recipientUid === context.auth.uid) {
            throw new functions.https.HttpsError('invalid-argument', 'Caller and recipient cannot be the same user');
        }

        // Validate that the caller is actually the one making the call
        const callDoc = await admin.firestore().collection('voice_calls').doc(callId).get();
        if (!callDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Call not found');
        }
        const callData = callDoc.data();
        if (callData?.callerUid !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Not the caller');
        }
        if (callData?.recipientUid !== recipientUid) {
            throw new functions.https.HttpsError('permission-denied', 'Recipient mismatch for this call');
        }

        const allTokens = await collectPushTokensForUid(recipientUid);
        let totalSent = 0;

        for (const token of allTokens) {
            const success = await sendPushToToken(
                token,
                `📞 ${callerName || 'Bilinmeyen'}`,
                `${callerName || 'Bilinmeyen'} sizi arıyor...`,
                {
                    type: 'voice_call',
                    callId,
                    callerUid: context.auth.uid,
                    callerName: callerName || '',
                },
            );
            if (success) totalSent++;
        }

        return { success: totalSent > 0, sentCount: totalSent };
    });
