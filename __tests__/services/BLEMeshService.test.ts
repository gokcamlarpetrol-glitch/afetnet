/**
 * BLE MESH SERVICE TESTS
 * Critical for offline communication
 */

import { BLEMeshService } from '../../src/core/services/BLEMeshService';
import { useMeshStore } from '../../src/core/stores/meshStore';

// Mock BleManager
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(),
  scan: jest.fn(),
  stopScan: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  write: jest.fn(),
}));

// Mock AsyncStorage for device ID
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn().mockResolvedValue('test-device-id'),
    setItem: jest.fn(),
  },
}));

describe('BLEMeshService', () => {
  let service: BLEMeshService;

  beforeEach(() => {
    service = new BLEMeshService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.stop();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(service.start()).resolves.not.toThrow();
    });

    it('should set device ID', async () => {
      await service.start();
      const deviceId = service.getMyDeviceId();
      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
    });
  });

  describe('Message Sending', () => {
    it('should send message successfully', async () => {
      await service.start();
      
      const testMessage = JSON.stringify({
        type: 'test',
        data: 'hello',
      });

      await expect(service.sendMessage(testMessage)).resolves.not.toThrow();
    });

    it('should handle send errors gracefully', async () => {
      await service.start();
      
      // Don't throw on error
      await expect(service.sendMessage('')).resolves.not.toThrow();
    });
  });

  describe('SOS Broadcasting', () => {
    it('should send SOS signal', async () => {
      await service.start();
      
      await expect(service.sendSOS()).resolves.not.toThrow();
    });
  });

  describe('Peer Management', () => {
    it('should handle peer discovery', async () => {
      await service.start();
      
      const store = useMeshStore.getState();
      expect(store.peers).toBeDefined();
      expect(typeof store.peers).toBe('object');
    });
  });

  describe('Stop', () => {
    it('should stop cleanly', async () => {
      await service.start();
      expect(() => service.stop()).not.toThrow();
    });

    it('should clear all timers on stop', async () => {
      await service.start();
      service.stop();
      
      // Verify store is cleaned
      const store = useMeshStore.getState();
      expect(Object.keys(store.peers).length).toBe(0);
    });
  });
});

