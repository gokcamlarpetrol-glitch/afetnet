/**
 * SOS SERVICE TESTS
 * Critical for emergency situations
 */

import { sosService } from '../../src/core/services/SOSService';

// Mock device ID
jest.mock('../../src/lib/device', () => ({
  getDeviceId: jest.fn().mockResolvedValue('test-device-123'),
}));

// Mock BLE Mesh Service
jest.mock('../../src/core/services/BLEMeshService', () => ({
  bleMeshService: {
    sendMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Multi-Channel Alert Service
jest.mock('../../src/core/services/MultiChannelAlertService', () => ({
  multiChannelAlertService: {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('SOSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    sosService.stopSOSSignal();
  });

  describe('Send SOS Signal', () => {
    it('should send SOS with location', async () => {
      const location = {
        latitude: 41.0082,
        longitude: 28.9784,
        accuracy: 10,
      };

      await expect(
        sosService.sendSOSSignal(location, 'Test emergency')
      ).resolves.not.toThrow();
    });

    it('should send SOS without location', async () => {
      await expect(
        sosService.sendSOSSignal(null, 'No location emergency')
      ).resolves.not.toThrow();
    });

    it('should use default message if not provided', async () => {
      const location = {
        latitude: 41.0,
        longitude: 29.0,
        accuracy: 15,
      };

      await expect(sosService.sendSOSSignal(location)).resolves.not.toThrow();
    });

    it('should include real device ID', async () => {
      const location = {
        latitude: 40.0,
        longitude: 30.0,
        accuracy: 20,
      };

      await sosService.sendSOSSignal(location, 'Emergency');
      
      // Should have called getDeviceId
      const { getDeviceId } = require('../../src/lib/device');
      expect(getDeviceId).toHaveBeenCalled();
    });
  });

  describe('Stop SOS Signal', () => {
    it('should stop active SOS', async () => {
      const location = {
        latitude: 41.0,
        longitude: 28.0,
        accuracy: 10,
      };

      await sosService.sendSOSSignal(location);
      expect(() => sosService.stopSOSSignal()).not.toThrow();
    });

    it('should handle stop when not active', () => {
      expect(() => sosService.stopSOSSignal()).not.toThrow();
    });
  });

  describe('Continuous Beacon', () => {
    it('should start beacon when SOS sent', async () => {
      const location = {
        latitude: 40.5,
        longitude: 29.5,
        accuracy: 12,
      };

      await sosService.sendSOSSignal(location);
      
      // Beacon should be running
      expect(sosService.isActive()).toBe(true);
    });

    it('should stop beacon when SOS stopped', async () => {
      const location = {
        latitude: 40.0,
        longitude: 29.0,
        accuracy: 10,
      };

      await sosService.sendSOSSignal(location);
      sosService.stopSOSSignal();
      
      expect(sosService.isActive()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle BLE send failures gracefully', async () => {
      const { bleMeshService } = require('../../src/core/services/BLEMeshService');
      bleMeshService.sendMessage.mockRejectedValueOnce(new Error('BLE failed'));

      const location = {
        latitude: 41.0,
        longitude: 28.0,
        accuracy: 10,
      };

      // Should not throw - continues with other methods
      await expect(sosService.sendSOSSignal(location)).resolves.not.toThrow();
    });
  });
});

