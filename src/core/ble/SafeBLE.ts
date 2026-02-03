/**
 * SAFE BLE - ELITE EDITION V2
 * Cross-platform BLE Peripheral wrapper with GATT server support.
 *
 * Features:
 * - Advertising for discovery
 * - GATT Server for large message transfer
 * - Message chunking (BLE MTU limit ~200 bytes)
 * - Connection state management
 * - Error recovery
 */

import BlePeripheral from 'react-native-ble-peripheral';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import {
  AFETNET_SERVICE_UUID,
  AFETNET_CHAR_MSG_UUID,
  AFETNET_CHAR_CHUNK_UUID,
  MAX_CHUNK_SIZE,
  MANUFACTURER_ID,
} from './constants';
import { createLogger } from '../utils/logger';

const logger = createLogger('SafeBLE');

// Message chunk header format: [total_chunks:1][chunk_index:1][data:N]
const CHUNK_HEADER_SIZE = 2;

export interface ConnectionState {
    isAdvertising: boolean;
    connectedDevices: string[];
    lastError: string | null;
}

class SafeBLEImpl {
  private state: ConnectionState = {
    isAdvertising: false,
    connectedDevices: [],
    lastError: null,
  };
  private isServiceSetup = false;

  /**
     * Check if BLE Peripheral is available
     */
  async isAvailable(): Promise<boolean> {
    try {
      return !!BlePeripheral && typeof BlePeripheral.startAdvertising === 'function';
    } catch {
      return false;
    }
  }

  /**
     * Setup GATT service and characteristics (call once)
     */
  async setupService(): Promise<boolean> {
    if (this.isServiceSetup) return true;

    try {
      if (!(await this.isAvailable())) {
        logger.warn('BlePeripheral not available');
        return false;
      }

      // Add primary service
      await BlePeripheral.addService(AFETNET_SERVICE_UUID, true);

      // Add message characteristic (for small messages via notify)
      await BlePeripheral.addCharacteristicToService(
        AFETNET_SERVICE_UUID,
        AFETNET_CHAR_MSG_UUID,
        16 | 8, // Notify | Write
        1 | 4,   // Read | Write permission
      );

      // Add chunk characteristic (for large message chunks)
      await BlePeripheral.addCharacteristicToService(
        AFETNET_SERVICE_UUID,
        AFETNET_CHAR_CHUNK_UUID,
        16 | 8 | 2, // Notify | Write | Read
        1 | 4,       // Read | Write permission
      );

      this.isServiceSetup = true;
      logger.info('SafeBLE: GATT Service setup complete');
      return true;
    } catch (error) {
      logger.error('Service setup failed', error);
      this.state.lastError = String(error);
      return false;
    }
  }

  /**
     * Advertise small payload (fits in manufacturer data)
     */
  async advertise(payload: Uint8Array): Promise<void> {
    if (!(await this.isAvailable())) {
      logger.warn('BlePeripheral not available');
      return;
    }

    try {
      await this.setupService();

      const manufacturerData = Buffer.from(payload).toString('hex');

      await BlePeripheral.startAdvertising({
        name: 'AfetNet',
        serviceUuids: [AFETNET_SERVICE_UUID],
        manufacturerData: {
          manufacturerId: MANUFACTURER_ID,
          data: manufacturerData,
        },
      });

      this.state.isAdvertising = true;
    } catch (error) {
      logger.warn('Advertise error', error);
      this.state.lastError = String(error);
      throw error;
    }
  }

  /**
     * Send large message via chunking
     * For messages that don't fit in advertising data
     */
  async sendLargeMessage(payload: Uint8Array): Promise<void> {
    if (!(await this.isAvailable())) {
      logger.warn('Not available for large message');
      return;
    }

    try {
      await this.setupService();

      const chunks = this.splitIntoChunks(payload);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        // Create chunk with header [total][index][data]
        const header = Buffer.alloc(CHUNK_HEADER_SIZE);
        header.writeUInt8(totalChunks, 0);
        header.writeUInt8(i, 1);

        const chunkWithHeader = Buffer.concat([header, chunks[i]]);

        // Send via characteristic notification
        await BlePeripheral.sendNotificationToDevices(
          AFETNET_SERVICE_UUID,
          AFETNET_CHAR_CHUNK_UUID,
          chunkWithHeader.toString('base64'),
        );

        // Small delay between chunks to prevent overflow
        await this.delay(50);
      }

      logger.debug(`SafeBLE: Sent ${totalChunks} chunks`);
    } catch (error) {
      logger.error('Large message send failed', error);
      this.state.lastError = String(error);
    }
  }

  /**
     * Start advertising
     */
  async startAdvertise(deviceName: string, serviceUUID: string): Promise<boolean> {
    try {
      // ELITE: Check if BLE is available before attempting operations
      if (!BlePeripheral || !BlePeripheral.startAdvertising) {
        // Silent return in simulator - BLE not available
        return false;
      }
      await this.stopAdvertise();
      await BlePeripheral.startAdvertising({
        name: deviceName,
        serviceUuids: [serviceUUID],
      });
      this.state.isAdvertising = true;
      return true;
    } catch (error) {
      // ELITE: Only log in dev mode for debugging
      if (__DEV__ && error instanceof Error && !error.message?.includes('null')) {
        logger.warn('Start advertise error', error);
      }
      return false;
    }
  }

  async sendMessage(deviceId: string, data: string): Promise<void> {
    try {
      await BlePeripheral.write(deviceId, AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID, data);
    } catch (e) {
      // benign error in mock/sim
    }
  }

  async sendToAll(data: string): Promise<void> {
    for (const deviceId of this.state.connectedDevices) {
      await this.sendMessage(deviceId, data);
    }
  }

  /**
     * Stop advertising
     */
  async stopAdvertise(): Promise<void> {
    try {
      // ELITE: Check if BLE is available before attempting operations
      if (!BlePeripheral || !BlePeripheral.stopAdvertising) {
        // Silent return in simulator - BLE not available
        this.state.isAdvertising = false;
        return;
      }
      await BlePeripheral.stopAdvertising();
      this.state.isAdvertising = false;
    } catch (error) {
      // ELITE: Silent fallback - don't log null errors in simulator
      this.state.isAdvertising = false;
    }
  }

  /**
     * Get connection state
     */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
     * Reset error state
     */
  clearError(): void {
    this.state.lastError = null;
  }

  // Private Helpers

  private splitIntoChunks(data: Uint8Array): Buffer[] {
    const chunks: Buffer[] = [];
    const maxDataPerChunk = MAX_CHUNK_SIZE - CHUNK_HEADER_SIZE;
    const buffer = Buffer.from(data);

    for (let offset = 0; offset < buffer.length; offset += maxDataPerChunk) {
      const end = Math.min(offset + maxDataPerChunk, buffer.length);
      chunks.push(buffer.slice(offset, end));
    }

    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const SafeBLE = new SafeBLEImpl();
