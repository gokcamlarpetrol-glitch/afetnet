/**
 * MESSAGING OUTCOME TYPES
 *
 * Provides structured result types for the messaging pipeline so that
 * partial failures (e.g., message persisted but inbox write failed) are
 * explicitly represented rather than collapsed into a boolean.
 *
 * The Cloud Function onNewConversationMessageV3 → syncConversationInboxV3
 * provides a server-side backup for inbox delivery. When the client-side
 * inbox write fails but the message document IS written to Firestore,
 * the CF's onCreate trigger fires and writes the inbox entry server-side.
 * This is why `partial_success` (message persisted, inbox failed) can be
 * treated as success for queue removal — the CF provides the safety net.
 */

export type MessageSendOutcome = {
  /**
   * Overall status of the send operation:
   * - `full_success`: Message persisted to Firestore AND all recipient inbox writes succeeded.
   * - `partial_success`: Message persisted to Firestore but one or more recipient inbox writes failed.
   *    The CF (onNewConversationMessageV3 → syncConversationInboxV3) will handle inbox delivery server-side.
   * - `retryable_failure`: Message could not be written to Firestore (network/timeout). Keep in retry queue.
   * - `permanent_failure`: Unrecoverable error (e.g., permission denied, no auth). Remove from queue and mark failed.
   */
  status: 'full_success' | 'partial_success' | 'retryable_failure' | 'permanent_failure';

  /** Whether the message document was written to conversations/{id}/messages/{id} */
  messagePersisted: boolean;

  /** Whether ALL recipient inbox writes (user_inbox/{uid}/threads/{id}) succeeded */
  inboxDelivered: boolean;

  /** The resolved conversation ID (if available) */
  conversationId?: string;

  /** Error message for logging/debugging (not shown to user) */
  error?: string;
};

/**
 * Backward-compatible wrapper that includes the legacy `success` field
 * alongside the new structured outcome. This allows callers that only
 * check `.success` to keep working while new code can use `.outcome`.
 */
export type SaveMessageResult = {
  /** Legacy boolean success indicator. True when outcome is full_success or partial_success. */
  success: boolean;
  /** The resolved conversation ID (if available) */
  conversationId?: string;
  /** Structured outcome with granular failure information */
  outcome: MessageSendOutcome;
};
