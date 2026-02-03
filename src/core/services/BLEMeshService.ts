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

logger.warn('⚠️ BLEMeshService is deprecated. Use meshNetworkService instead.');

/**
 * @deprecated Use meshNetworkService directly
 */
class BLEMeshService {
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
