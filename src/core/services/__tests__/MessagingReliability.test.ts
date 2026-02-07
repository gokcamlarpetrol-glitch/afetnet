jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

jest.mock('../../../lib/device', () => ({
  getDeviceId: jest.fn().mockResolvedValue('AFN-TEST0001'),
  setDeviceId: jest.fn().mockResolvedValue(undefined),
  clearDeviceId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../mesh/MeshNetworkService', () => ({
  meshNetworkService: {
    onMessage: jest.fn(() => () => undefined),
    broadcastMessage: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn(() => 'offline'),
  },
  __esModule: true,
  default: {
    onMessage: jest.fn(() => () => undefined),
    broadcastMessage: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn(() => 'offline'),
  },
}));

jest.mock('../IdentityService', () => ({
  identityService: {
    getIdentity: jest.fn(() => ({
      id: 'AFN-TEST0001',
      deviceId: 'AFN-TEST0001',
      displayName: 'Test User',
      cloudUid: 'uid-test-1',
    })),
  },
}));

import { hybridMessageService } from '../HybridMessageService';

describe('Messaging reliability hardening', () => {
  const hybrid = hybridMessageService as any;

  it('maps hybrid message types to cloud-safe types', () => {
    expect(hybrid.mapHybridTypeToCloudType('CHAT')).toBe('text');
    expect(hybrid.mapHybridTypeToCloudType('SOS')).toBe('sos');
    expect(hybrid.mapHybridTypeToCloudType('IMAGE')).toBe('image');
    expect(hybrid.mapHybridTypeToCloudType('VOICE')).toBe('voice');
    expect(hybrid.mapHybridTypeToCloudType('LOCATION')).toBe('location');
  });

  it('maps cloud message types back to hybrid/media-aware types', () => {
    expect(hybrid.mapCloudTypeToHybridType('sos')).toBe('SOS');
    expect(hybrid.mapCloudTypeToHybridType('image')).toBe('IMAGE');
    expect(hybrid.mapCloudTypeToHybridType('voice')).toBe('VOICE');
    expect(hybrid.mapCloudTypeToHybridType('location')).toBe('LOCATION');

    // Fallback behavior when legacy cloud type is plain text
    expect(hybrid.mapCloudTypeToHybridType('text', 'image', false)).toBe('IMAGE');
    expect(hybrid.mapCloudTypeToHybridType('text', 'voice', false)).toBe('VOICE');
    expect(hybrid.mapCloudTypeToHybridType('text', 'location', false)).toBe('LOCATION');
    expect(hybrid.mapCloudTypeToHybridType('text', undefined, true)).toBe('LOCATION');
    expect(hybrid.mapCloudTypeToHybridType('text', undefined, false)).toBe('CHAT');
  });

  it('normalizes location payload from both lat/lng and latitude/longitude contracts', () => {
    expect(hybrid.normalizeLocationPayload({ lat: 38.42, lng: 27.14, address: 'Izmir' })).toEqual({
      lat: 38.42,
      lng: 27.14,
      address: 'Izmir',
    });

    expect(hybrid.normalizeLocationPayload({ latitude: 39.93, longitude: 32.85 })).toEqual({
      lat: 39.93,
      lng: 32.85,
    });

    expect(hybrid.normalizeLocationPayload({ latitude: 'bad', longitude: 32.85 })).toBeUndefined();
    expect(hybrid.normalizeLocationPayload(null)).toBeUndefined();
  });
});
