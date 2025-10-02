import { EEWDetector, EEWDetectionOptions, EEWDetectionResult } from '../core/sensors/eew';
import { EEWManager } from '../core/logic/eew';
import { EEWFilter } from '../core/eew/filter';
import { OfficialFeedManager } from '../core/eew/feeds';
import { EEWAlarmManager } from '../core/audio/alarm';
import { MessageEncoder } from '../core/p2p/message';

// Mock expo-sensors
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((callback) => ({
      remove: jest.fn(),
    })),
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    },
  })),
  Accuracy: {
    Balanced: 'balanced',
  },
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          playAsync: jest.fn(),
          stopAsync: jest.fn(),
          unloadAsync: jest.fn(),
          setVolumeAsync: jest.fn(),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      })),
    },
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock P2PManager
jest.mock('../core/p2p', () => ({
  P2PManager: {
    getInstance: jest.fn(() => ({
      on: jest.fn(),
      enqueueMessage: jest.fn(),
      getInstance: jest.fn(),
    })),
  },
}));

describe('EEW (Early Warning) System', () => {
  let eewDetector: EEWDetector;
  let eewManager: EEWManager;
  let eewFilter: EEWFilter;
  let officialFeedManager: OfficialFeedManager;
  let alarmManager: EEWAlarmManager;

  beforeEach(() => {
    eewDetector = EEWDetector.getInstance();
    eewManager = EEWManager.getInstance();
    eewFilter = EEWFilter.getInstance();
    officialFeedManager = OfficialFeedManager.getInstance();
    alarmManager = EEWAlarmManager.getInstance();
    
    jest.clearAllMocks();
  });

  describe('EEWDetector', () => {
    it('should initialize with default options', () => {
      const options = eewDetector.getOptions();
      
      expect(options.staMs).toBe(500);
      expect(options.ltaMs).toBe(3000);
      expect(options.pThreshold).toBe(3.0);
      expect(options.minGapMs).toBe(30000);
      expect(options.minAccelG).toBe(0.08);
      expect(options.updateIntervalMs).toBe(20);
    });

    it('should start detection with custom options', async () => {
      const customOptions: EEWDetectionOptions = {
        staMs: 300,
        ltaMs: 2000,
        pThreshold: 2.5,
        minGapMs: 20000,
        minAccelG: 0.1,
        updateIntervalMs: 16,
      };

      await eewDetector.startEEWDetection(customOptions);
      
      expect(eewDetector.getIsDetecting()).toBe(true);
      
      const options = eewDetector.getOptions();
      expect(options.staMs).toBe(300);
      expect(options.ltaMs).toBe(2000);
      expect(options.pThreshold).toBe(2.5);
      expect(options.minGapMs).toBe(20000);
      expect(options.minAccelG).toBe(0.1);
      expect(options.updateIntervalMs).toBe(16);
    });

    it('should stop detection', () => {
      eewDetector.stopEEWDetection();
      
      expect(eewDetector.getIsDetecting()).toBe(false);
    });

    it('should simulate detection for testing', () => {
      const listener = jest.fn();
      eewDetector.on('eew:local_pwave', listener);
      
      eewDetector.simulateDetection(4.0, 0.12);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          strength: 4.0,
          acceleration: expect.objectContaining({
            magnitude: expect.any(Number),
          }),
        })
      );
    });

    it('should calculate STA and LTA correctly', () => {
      // This would require more complex testing with actual accelerometer data
      // For now, just test that the methods exist and return numbers
      const sta = eewDetector.getCurrentSTA();
      const lta = eewDetector.getCurrentLTA();
      
      expect(typeof sta).toBe('number');
      expect(typeof lta).toBe('number');
    });
  });

  describe('EEWManager', () => {
    it('should initialize with default config', () => {
      const config = eewManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.k).toBe(5);
      expect(config.radiusKm).toBe(8);
      expect(config.windowSec).toBe(5);
      expect(config.pThreshold).toBe(3.0);
    });

    it('should update config', async () => {
      const updates = {
        k: 7,
        radiusKm: 10,
        windowSec: 7,
      };
      
      await eewManager.updateConfig(updates);
      const config = eewManager.getConfig();
      
      expect(config.k).toBe(7);
      expect(config.radiusKm).toBe(10);
      expect(config.windowSec).toBe(7);
    });

    it('should simulate cluster alert', () => {
      const listener = jest.fn();
      eewManager.on('eew:cluster_alert', listener);
      
      eewManager.simulateClusterAlert(8, 4.5);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceCount: 8,
          avgStrength: 4.5,
          confidence: 'high',
        })
      );
    });

    it('should simulate official alert', () => {
      const listener = jest.fn();
      eewManager.on('eew:official_alert', listener);
      
      eewManager.simulateOfficialAlert(6.8, 18);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          magnitude: 6.8,
          etaSeconds: 18,
          source: 'AFAD',
          confidence: 'high',
        })
      );
    });
  });

  describe('EEWFilter', () => {
    it('should initialize with default config', () => {
      const config = eewFilter.getConfig();
      
      expect(config.requireQuorum).toBe(true);
      expect(config.requireOfficial).toBe(false);
      expect(config.deviceCooldownMs).toBe(60000);
      expect(config.regionCooldownMs).toBe(30000);
      expect(config.silentPrepEnabled).toBe(true);
    });

    it('should filter local P-wave events', async () => {
      const localEvent = {
        timestamp: Date.now(),
        strength: 4.0,
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        acceleration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
        sta: 0.4,
        lta: 0.1,
      };

      const result = await eewFilter.filterLocalPWave(localEvent, true, false);
      
      expect(result.shouldAlert).toBe(true);
      expect(result.shouldSilentPrep).toBe(false);
    });

    it('should require quorum when configured', async () => {
      await eewFilter.updateConfig({ requireQuorum: true });
      
      const localEvent = {
        timestamp: Date.now(),
        strength: 4.0,
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        acceleration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
        sta: 0.4,
        lta: 0.1,
      };

      const result = await eewFilter.filterLocalPWave(localEvent, false, false);
      
      expect(result.shouldAlert).toBe(false);
      expect(result.shouldSilentPrep).toBe(true);
      expect(result.reason).toBe('Quorum required but not available');
    });

    it('should respect device cooldown', async () => {
      eewFilter.simulateDeviceCooldown();
      
      const localEvent = {
        timestamp: Date.now(),
        strength: 4.0,
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        acceleration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
        sta: 0.4,
        lta: 0.1,
      };

      const result = await eewFilter.filterLocalPWave(localEvent, true, false);
      
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('Device cooldown active');
    });

    it('should clear cooldowns for testing', () => {
      eewFilter.simulateDeviceCooldown();
      eewFilter.simulateRegionCooldown(41.0082, 28.9784);
      
      expect(eewFilter.getLastDeviceAlert()).toBeGreaterThan(0);
      expect(eewFilter.getAlertHistory().length).toBeGreaterThan(0);
      
      eewFilter.clearCooldowns();
      
      expect(eewFilter.getLastDeviceAlert()).toBe(0);
      expect(eewFilter.getAlertHistory().length).toBe(0);
    });
  });

  describe('OfficialFeedManager', () => {
    it('should initialize with default config', () => {
      const config = officialFeedManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.url).toBe('');
      expect(config.pollIntervalMs).toBe(30000);
      expect(config.timeoutMs).toBe(10000);
    });

    it('should update config', async () => {
      const updates = {
        enabled: true,
        url: 'https://api.example.com/earthquakes',
        pollIntervalMs: 15000,
      };
      
      await officialFeedManager.updateConfig(updates);
      const config = officialFeedManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.url).toBe('https://api.example.com/earthquakes');
      expect(config.pollIntervalMs).toBe(15000);
    });

    it('should simulate official alert', async () => {
      const listener = jest.fn();
      officialFeedManager.on('eew:official_alert', listener);
      
      await officialFeedManager.simulateOfficialAlert(7.2, 12);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          magnitude: 7.2,
          etaSeconds: 12,
          source: 'AFAD_TEST',
          confidence: 'high',
        })
      );
    });
  });

  describe('EEWAlarmManager', () => {
    it('should initialize with default config', () => {
      const config = alarmManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(1.0);
      expect(config.duration).toBe(10);
      expect(config.repeat).toBe(true);
    });

    it('should update config', () => {
      const updates = {
        volume: 0.8,
        duration: 15,
        repeat: false,
      };
      
      alarmManager.updateConfig(updates);
      const config = alarmManager.getConfig();
      
      expect(config.volume).toBe(0.8);
      expect(config.duration).toBe(15);
      expect(config.repeat).toBe(false);
    });

    it('should test alarm', async () => {
      await alarmManager.testAlarm();
      
      expect(alarmManager.getIsPlaying()).toBe(true);
      
      await alarmManager.stopEEWAlarm();
      expect(alarmManager.getIsPlaying()).toBe(false);
    });
  });

  describe('Message Schema', () => {
    it('should create EEW P-wave message', () => {
      const message = MessageEncoder.createEEWPWave({
        id: 'test-eew-123',
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        strength: 4.2,
        deviceId: 'device-456',
      });
      
      expect(message.t).toBe(3); // EEW_P type
      expect(message.id).toBe('test-eew-123');
      expect(message.prio).toBe(2); // Critical priority
      expect(message.ttl).toBe(2); // Small TTL
      expect(message.str).toBe(4.2);
      expect(message.note).toBe('EEW_P:device-456');
    });

    it('should create EEW ACK message', () => {
      const message = MessageEncoder.createEEWAck({
        id: 'test-ack-123',
        referenceId: 'eew-ref-456',
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
      });
      
      expect(message.t).toBe(4); // EEW_ACK type
      expect(message.id).toBe('test-ack-123');
      expect(message.prio).toBe(1); // High priority
      expect(message.ttl).toBe(1); // Very small TTL
      expect(message.ref).toBe('eew-ref-456');
      expect(message.note).toBe('EEW_ACK:eew-ref-456');
    });

    it('should validate EEW message types', () => {
      const validEEWMessage = {
        t: 3,
        id: 'test-123',
        ts: Date.now(),
        loc: { lat: 41.0082, lon: 28.9784, acc: 10 },
        prio: 2,
        flags: { underRubble: false, injured: false, anonymity: false },
        ppl: 1,
        ttl: 2,
        str: 4.0,
      };
      
      // Should not throw validation error
      expect(() => MessageEncoder.encode(validEEWMessage)).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete EEW flow', async () => {
      // Simulate local P-wave detection
      const localEvent = {
        timestamp: Date.now(),
        strength: 4.5,
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        acceleration: { x: 0.12, y: 0.11, z: 0.13, magnitude: 0.21 },
        sta: 0.45,
        lta: 0.10,
      };

      // Filter the event
      const filterResult = await eewFilter.filterLocalPWave(localEvent, true, false);
      expect(filterResult.shouldAlert).toBe(true);

      // Simulate cluster alert
      const clusterListener = jest.fn();
      eewManager.on('eew:cluster_alert', clusterListener);
      
      eewManager.simulateClusterAlert(6, 4.5);
      
      expect(clusterListener).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceCount: 6,
          avgStrength: 4.5,
          confidence: 'high',
        })
      );
    });

    it('should handle official alert flow', async () => {
      const officialListener = jest.fn();
      officialFeedManager.on('eew:official_alert', officialListener);
      
      await officialFeedManager.simulateOfficialAlert(6.8, 15);
      
      expect(officialListener).toHaveBeenCalledWith(
        expect.objectContaining({
          magnitude: 6.8,
          etaSeconds: 15,
          source: 'AFAD_TEST',
        })
      );
    });

    it('should respect cooldowns across components', async () => {
      // Set device cooldown
      eewFilter.simulateDeviceCooldown();
      
      const localEvent = {
        timestamp: Date.now(),
        strength: 4.0,
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        acceleration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
        sta: 0.4,
        lta: 0.1,
      };

      // Should be filtered out due to cooldown
      const result = await eewFilter.filterLocalPWave(localEvent, true, false);
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('Device cooldown active');
    });
  });

  describe('Error Handling', () => {
    it('should handle detection errors gracefully', () => {
      const errorListener = jest.fn();
      eewDetector.on('eew:detection_error', errorListener);
      
      // Simulate error by calling stop without starting
      eewDetector.stopEEWDetection();
      
      // Should not crash and should handle gracefully
      expect(eewDetector.getIsDetecting()).toBe(false);
    });

    it('should handle filter errors gracefully', async () => {
      const invalidEvent = {
        timestamp: -1, // Invalid timestamp
        strength: 4.0,
        lat: 200, // Invalid latitude
        lon: 200, // Invalid longitude
        accuracy: 10,
        acceleration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
        sta: 0.4,
        lta: 0.1,
      };

      const result = await eewFilter.filterLocalPWave(invalidEvent, true, false);
      
      // Should return safe defaults rather than crashing
      expect(result.shouldAlert).toBe(false);
      expect(result.shouldSilentPrep).toBe(false);
    });
  });
});
