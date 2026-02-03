/**
 * EEW WEBSOCKET MANAGER - ELITE EDITION
 * Handles WebSocket connections for Early Earthquake Warning
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('EEWWebSocketManager');

// WebSocket endpoints
const WS_ENDPOINTS = {
  TR: 'wss://ws.afad.gov.tr/eew', // Turkey AFAD WebSocket (if available)
  GLOBAL: 'wss://api.p2pquake.net/v2/ws', // P2PQuake Japan
};

export interface WebSocketConfig {
  region: 'TR' | 'GLOBAL';
  onMessage: (data: any) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (error: any) => void;
}

export interface WebSocketState {
  connected: boolean;
  region: 'TR' | 'GLOBAL' | null;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
}

// State
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let config: WebSocketConfig | null = null;

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 2000;
const HEARTBEAT_INTERVAL = 30000;

/**
 * ELITE: Get WebSocket state
 */
export function getState(): WebSocketState {
  return {
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    region: config?.region || null,
    reconnectAttempts,
    lastConnectedAt: null,
  };
}

/**
 * ELITE: Connect to WebSocket
 */
export function connect(newConfig: WebSocketConfig): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.debug('WebSocket already connected');
    return;
  }

  config = newConfig;
  const endpoint = WS_ENDPOINTS[newConfig.region];

  logger.info(`🔌 Connecting to EEW WebSocket: ${endpoint}`);

  try {
    ws = new WebSocket(endpoint);

    ws.onopen = () => {
      logger.info('✅ EEW WebSocket connected');
      reconnectAttempts = 0;
      config?.onOpen?.();
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        config?.onMessage?.(data);
      } catch (parseError) {
        logger.debug('Non-JSON WebSocket message:', event.data);
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
      config?.onError?.(error);
    };

    ws.onclose = () => {
      logger.info('WebSocket closed');
      stopHeartbeat();
      config?.onClose?.();
      attemptReconnect();
    };
  } catch (error) {
    logger.error('Failed to create WebSocket:', error);
    config?.onError?.(error);
    attemptReconnect();
  }
}

/**
 * ELITE: Disconnect WebSocket
 */
export function disconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  stopHeartbeat();

  if (ws) {
    ws.onclose = null; // Prevent reconnect on intentional close
    ws.close();
    ws = null;
  }

  reconnectAttempts = 0;
  config = null;

  logger.info('🔌 EEW WebSocket disconnected');
}

/**
 * ELITE: Attempt reconnection with exponential backoff
 */
function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.warn('Max reconnect attempts reached');
    return;
  }

  if (!config) {
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts - 1);

  logger.info(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  reconnectTimeout = setTimeout(() => {
    if (config) {
      connect(config);
    }
  }, delay);
}

/**
 * ELITE: Start heartbeat to keep connection alive
 */
function startHeartbeat(): void {
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        // ELITE: Non-critical - heartbeat failure doesn't break connection
        logger.debug('Heartbeat send failed');
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * ELITE: Stop heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * ELITE: Send data through WebSocket
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function send(data: any): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logger.debug('Cannot send - WebSocket not connected');
    return false;
  }

  try {
    ws.send(JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error('Failed to send WebSocket message:', error);
    return false;
  }
}

/**
 * ELITE: Check if connected
 */
export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
