/**
 * EEW MODULE - ELITE EDITION
 * Re-exports all EEW functionality
 * 
 * This is the main entry point for modular EEW services.
 */

// WebSocket management
export * as EEWWebSocketManager from './EEWWebSocketManager';
export type { WebSocketConfig, WebSocketState } from './EEWWebSocketManager';

// Polling
export * as EEWPoller from './EEWPoller';
export type { PollConfig, PollerState } from './EEWPoller';

// Event processing
export * as EEWEventProcessor from './EEWEventProcessor';
export type { EEWEvent, RawEarthquakeData } from './EEWEventProcessor';

// Re-export main service for backward compatibility
export { eewService } from '../EEWService';
