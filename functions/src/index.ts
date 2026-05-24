/**
 * AFETNET FIREBASE FUNCTIONS - EEW ELITE BACKEND V2
 *
 * HAYAT KURTARAN SUNUCU TARAFLI EEW SİSTEMİ
 *
 * V2 FEATURES:
 * - Multi-source monitoring: AFAD + Kandilli + USGS + EMSC
 * - Fast polling: Every 10-30 seconds (configurable)
 * - Location-based push: Only notify nearby users
 * - Retry mechanism: Exponential backoff for FCM failures
 * - Backup functions: Redundancy for critical operations
 * - Europe-west1 region: Low latency for Turkey
 *
 * PERFORMANCE:
 * - Detection to FCM: < 500ms
 * - Global push delivery: < 2 seconds
 * - Multi-source verification: < 1 second
 *
 * MODULE ORGANIZATION:
 * - utils.ts    — Shared helpers, types, constants, push infrastructure
 * - eew.ts      — EEW monitoring, P-wave detection, broadcast, webhook
 * - messaging.ts — Message push notifications (legacy + V3), contact requests
 * - sos.ts      — SOS alert push (legacy + V3), global SOS broadcast
 * - family.ts   — Family status update push (legacy + V3)
 * - admin.ts    — Analytics, token cleanup, email, OpenAI proxy, FCM registration
 *
 * @version 2.0.0
 * @elite true
 * @lifesaving true
 */

// Initialize Firebase Admin (must happen before any module import that uses it)
import * as admin from 'firebase-admin';
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// ============================================================
// EEW MODULE — Early Earthquake Warning
// ============================================================
export { eewMonitorFast } from './eew';
export { eewMonitorBackup } from './eew';
export { eewEmergencyTrigger } from './eew';
export { onPWaveDetection } from './eew';
export { broadcastEEW } from './eew';
export { eewWebhook } from './eew';

// ============================================================
// MESSAGING MODULE — Message & Contact Request Push
// ============================================================
export { onNewMessage } from './messaging';
export { onNewConversationMessageV3 } from './messaging';
export { onContactRequest } from './messaging';

// ============================================================
// SOS MODULE — SOS Alert & Broadcast Push
// ============================================================
export { onSOSAlert } from './sos';
export { onSOSAlertV3 } from './sos';
export { onSOSBroadcast } from './sos';
export { onSOSBroadcastUpdated } from './sos';

// ============================================================
// FAMILY MODULE — Family Status Update Push
// ============================================================
export { onFamilyStatusUpdate } from './family';
export { onFamilyStatusUpdateV3 } from './family';

// ============================================================
// ADMIN MODULE — Analytics, Cleanup, Email, OpenAI, FCM Reg
// ============================================================
export { dailyAnalytics } from './admin';
export { tokenCleanup } from './admin';
export { locationHistoryCleanup } from './admin';
export { cleanupSeismicReports } from './admin';
export { sendCustomEmail } from './admin';
export { openAIChatProxy } from './admin';
export { registerFCMToken } from './admin';
export { subscribeToTopics } from './admin';
export { onSeismicReportCreated } from './admin';
export { auditFirestore } from './audit';

// ============================================================
// PRIVACY MODULE — GDPR/KVKK veri ihraç + silme
// ============================================================
export { exportUserData, onUserDeletedCleanup } from './privacy';
