/**
 * EEW MODULE - BARREL EXPORTS
 * 
 * Central export point for all EEW (Early Earthquake Warning) services
 * Import from this file instead of individual service files
 * 
 * @example
 * import { eewManager, EEWEvent, multiSourceEEWService } from '@/core/services/eew';
 * 
 * @version 1.0.0
 * @elite true
 */

// ============================================================
// TYPES & INTERFACES
// ============================================================

export type {
    EEWEvent,
    RawEarthquakeData,
} from './EEWEventProcessor';

// ============================================================
// EVENT PROCESSING
// ============================================================

export {
    normalizeEvent,
    normalizeEvents,
    isEventSeen,
    markEventSeen,
    clearSeenEvents,
    enhanceWithWaveCalculation,
    filterSignificantEvents,
} from './EEWEventProcessor';

// ============================================================
// POLLING
// ============================================================

export type {
    PollConfig,
    PollerState,
} from './EEWPoller';

export {
    start as startPoller,
    stop as stopPoller,
    pollNow,
    isRunning as isPollerRunning,
    getState as getPollerState,
} from './EEWPoller';

// ============================================================
// WEBSOCKET
// ============================================================

export type {
    WebSocketConfig,
    WebSocketState,
} from './EEWWebSocketManager';

export {
    connect as connectWebSocket,
    disconnect as disconnectWebSocket,
    getState as getWebSocketState,
    isConnected as isWebSocketConnected,
    send as sendWebSocket,
} from './EEWWebSocketManager';
