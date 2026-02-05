/**
 * BLE MESH SERVICE - DEPRECATED
 * 
 * This service has been consolidated into MeshNetworkService V3.
 * This file now acts as a thin wrapper for backward compatibility.
 * 
 * @deprecated Use meshNetworkService from './mesh/MeshNetworkService' instead.
 */

import { meshNetworkService } from './mesh/MeshNetworkService';
import { createLogger } from '../utils/logger';

const logger = createLogger('BLEMeshService');

// Note: Deprecation warning moved to constructor to avoid startup noise
let hasShownDeprecationWarning = false;

/**
 * @deprecated Use meshNetworkService directly
 */
class BLEMeshService {
  constructor() {
    // ELITE: Only show deprecation warning once and only when actually used
    if (!hasShownDeprecationWarning && __DEV__) {
      logger.debug('BLEMeshService is deprecated. Use meshNetworkService instead.');
      hasShownDeprecationWarning = true;
    }
  }

  async initialize() {
    return meshNetworkService.initialize();
  }

  async start() {
    return meshNetworkService.start();
  }

  stop() {
    return meshNetworkService.stop();
  }

  async broadcastMessage(msg: { type: string; content: string; priority?: string; ttl?: number }) {
    return meshNetworkService.broadcastMessage(msg.content);
  }

  async sendMessage(content: string, _to: string) {
    return meshNetworkService.broadcastMessage(content);
  }

  async sendSOS(reason: string) {
    return meshNetworkService.sendSOS(reason);
  }

  async broadcastEmergency(data: string) {
    return meshNetworkService.broadcastEmergency(data);
  }

  shareLocation(lat: number, lng: number) {
    return meshNetworkService.shareLocation(lat, lng);
  }

  onMessage(callback: (msg: any) => void) {
    return meshNetworkService.onMessage(callback);
  }

  getIsRunning() {
    return meshNetworkService.getIsRunning();
  }

  getMyDeviceId() {
    return meshNetworkService.getMyDeviceId();
  }
}

/**
 * @deprecated Use meshNetworkService from './mesh/MeshNetworkService' instead
 */
export const bleMeshService = new BLEMeshService();
