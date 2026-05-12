"use strict";
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
 * - voice.ts    — Voice call push notifications
 * - admin.ts    — Analytics, token cleanup, email, OpenAI proxy, FCM registration
 *
 * @version 2.0.0
 * @elite true
 * @lifesaving true
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditFirestore = exports.onSeismicReportCreated = exports.subscribeToTopics = exports.registerFCMToken = exports.openAIChatProxy = exports.sendCustomEmail = exports.cleanupSeismicReports = exports.locationHistoryCleanup = exports.tokenCleanup = exports.dailyAnalytics = exports.sendCallNotification = exports.onIncomingVoiceCall = exports.onFamilyStatusUpdateV3 = exports.onFamilyStatusUpdate = exports.onSOSBroadcastUpdated = exports.onSOSBroadcast = exports.onSOSAlertV3 = exports.onSOSAlert = exports.onContactRequest = exports.onNewConversationMessageV3 = exports.onNewMessage = exports.eewWebhook = exports.broadcastEEW = exports.onPWaveDetection = exports.eewEmergencyTrigger = exports.eewMonitorBackup = exports.eewMonitorFast = void 0;
// Initialize Firebase Admin (must happen before any module import that uses it)
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// ============================================================
// EEW MODULE — Early Earthquake Warning
// ============================================================
var eew_1 = require("./eew");
Object.defineProperty(exports, "eewMonitorFast", { enumerable: true, get: function () { return eew_1.eewMonitorFast; } });
var eew_2 = require("./eew");
Object.defineProperty(exports, "eewMonitorBackup", { enumerable: true, get: function () { return eew_2.eewMonitorBackup; } });
var eew_3 = require("./eew");
Object.defineProperty(exports, "eewEmergencyTrigger", { enumerable: true, get: function () { return eew_3.eewEmergencyTrigger; } });
var eew_4 = require("./eew");
Object.defineProperty(exports, "onPWaveDetection", { enumerable: true, get: function () { return eew_4.onPWaveDetection; } });
var eew_5 = require("./eew");
Object.defineProperty(exports, "broadcastEEW", { enumerable: true, get: function () { return eew_5.broadcastEEW; } });
var eew_6 = require("./eew");
Object.defineProperty(exports, "eewWebhook", { enumerable: true, get: function () { return eew_6.eewWebhook; } });
// ============================================================
// MESSAGING MODULE — Message & Contact Request Push
// ============================================================
var messaging_1 = require("./messaging");
Object.defineProperty(exports, "onNewMessage", { enumerable: true, get: function () { return messaging_1.onNewMessage; } });
var messaging_2 = require("./messaging");
Object.defineProperty(exports, "onNewConversationMessageV3", { enumerable: true, get: function () { return messaging_2.onNewConversationMessageV3; } });
var messaging_3 = require("./messaging");
Object.defineProperty(exports, "onContactRequest", { enumerable: true, get: function () { return messaging_3.onContactRequest; } });
// ============================================================
// SOS MODULE — SOS Alert & Broadcast Push
// ============================================================
var sos_1 = require("./sos");
Object.defineProperty(exports, "onSOSAlert", { enumerable: true, get: function () { return sos_1.onSOSAlert; } });
var sos_2 = require("./sos");
Object.defineProperty(exports, "onSOSAlertV3", { enumerable: true, get: function () { return sos_2.onSOSAlertV3; } });
var sos_3 = require("./sos");
Object.defineProperty(exports, "onSOSBroadcast", { enumerable: true, get: function () { return sos_3.onSOSBroadcast; } });
var sos_4 = require("./sos");
Object.defineProperty(exports, "onSOSBroadcastUpdated", { enumerable: true, get: function () { return sos_4.onSOSBroadcastUpdated; } });
// ============================================================
// FAMILY MODULE — Family Status Update Push
// ============================================================
var family_1 = require("./family");
Object.defineProperty(exports, "onFamilyStatusUpdate", { enumerable: true, get: function () { return family_1.onFamilyStatusUpdate; } });
var family_2 = require("./family");
Object.defineProperty(exports, "onFamilyStatusUpdateV3", { enumerable: true, get: function () { return family_2.onFamilyStatusUpdateV3; } });
// ============================================================
// VOICE MODULE — Voice Call Push
// ============================================================
var voice_1 = require("./voice");
Object.defineProperty(exports, "onIncomingVoiceCall", { enumerable: true, get: function () { return voice_1.onIncomingVoiceCall; } });
var voice_2 = require("./voice");
Object.defineProperty(exports, "sendCallNotification", { enumerable: true, get: function () { return voice_2.sendCallNotification; } });
// ============================================================
// ADMIN MODULE — Analytics, Cleanup, Email, OpenAI, FCM Reg
// ============================================================
var admin_1 = require("./admin");
Object.defineProperty(exports, "dailyAnalytics", { enumerable: true, get: function () { return admin_1.dailyAnalytics; } });
var admin_2 = require("./admin");
Object.defineProperty(exports, "tokenCleanup", { enumerable: true, get: function () { return admin_2.tokenCleanup; } });
var admin_3 = require("./admin");
Object.defineProperty(exports, "locationHistoryCleanup", { enumerable: true, get: function () { return admin_3.locationHistoryCleanup; } });
var admin_4 = require("./admin");
Object.defineProperty(exports, "cleanupSeismicReports", { enumerable: true, get: function () { return admin_4.cleanupSeismicReports; } });
var admin_5 = require("./admin");
Object.defineProperty(exports, "sendCustomEmail", { enumerable: true, get: function () { return admin_5.sendCustomEmail; } });
var admin_6 = require("./admin");
Object.defineProperty(exports, "openAIChatProxy", { enumerable: true, get: function () { return admin_6.openAIChatProxy; } });
var admin_7 = require("./admin");
Object.defineProperty(exports, "registerFCMToken", { enumerable: true, get: function () { return admin_7.registerFCMToken; } });
var admin_8 = require("./admin");
Object.defineProperty(exports, "subscribeToTopics", { enumerable: true, get: function () { return admin_8.subscribeToTopics; } });
var admin_9 = require("./admin");
Object.defineProperty(exports, "onSeismicReportCreated", { enumerable: true, get: function () { return admin_9.onSeismicReportCreated; } });
var audit_1 = require("./audit");
Object.defineProperty(exports, "auditFirestore", { enumerable: true, get: function () { return audit_1.auditFirestore; } });
//# sourceMappingURL=index.js.map