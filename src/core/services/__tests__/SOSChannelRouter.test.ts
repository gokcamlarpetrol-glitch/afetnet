const mockNetInfoFetch = jest.fn();
const mockMeshBroadcast = jest.fn();
const mockMeshStart = jest.fn();
const mockMeshIsRunning = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockNetInfoFetch(...args),
  },
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(async () => 0.8),
  getBatteryStateAsync: jest.fn(async () => 1),
  BatteryState: {
    CHARGING: 1,
  },
}));

import { sosChannelRouter } from '../sos/SOSChannelRouter';

describe('SOSChannelRouter channel behavior', () => {
  const buildMeshDependencies = (installationId = 'install-abc') => ({
    meshNetworkService: {
      getIsRunning: (...args: unknown[]) => mockMeshIsRunning(...args),
      start: (...args: unknown[]) => mockMeshStart(...args),
      broadcastMessage: (...args: unknown[]) => mockMeshBroadcast(...args),
    },
    MeshMessageType: {
      SOS: 'SOS',
    },
    getInstallationId: jest.fn(async () => installationId),
    getDisplayName: jest.fn(() => 'Test Sender'),
  });

  const signal = {
    id: 'sos-test-1',
    userId: 'UIDTARGET12345678901234',
    message: 'Acil yardım gerekiyor',
    location: {
      latitude: 41.01,
      longitude: 28.97,
      accuracy: 5,
      timestamp: Date.now(),
      source: 'gps' as const,
    },
    trapped: false,
    reason: 'manual',
    device: {
      batteryLevel: 87,
      networkType: 'wifi',
      isCharging: false,
      hasInternet: true,
      hasMeshConnection: true,
    },
    timestamp: Date.now(),
    status: 'broadcasting',
    acks: [],
    channels: {
      mesh: 'idle',
      firebase: 'idle',
      backend: 'idle',
      push: 'idle',
      family: 'idle',
      nearbyUsers: 'idle',
    },
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockMeshIsRunning.mockReturnValue(false);
    mockMeshStart.mockResolvedValue(undefined);
    mockMeshBroadcast.mockResolvedValue(undefined);
  });

  it('attempts firebase write even when offline (offline persistence queues it)', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      type: 'none',
    });

    const updateStatus = jest.fn();
    await (sosChannelRouter as any).broadcastViaFirebase(signal, updateStatus);

    // Firebase channel should attempt write (Firestore offline persistence queues it).
    // It will either succeed (queued) or fail (Firestore unavailable), but never skip.
    expect(updateStatus).toHaveBeenNthCalledWith(1, 'firebase', 'pending');
    expect(updateStatus).toHaveBeenNthCalledWith(2, 'firebase', 'sending');
  });

  it('broadcasts SOS over mesh with installation-scoped sender id', async () => {
    const updateStatus = jest.fn();
    jest
      .spyOn(sosChannelRouter as any, 'loadMeshDependencies')
      .mockResolvedValue(buildMeshDependencies());

    await (sosChannelRouter as any).broadcastViaMesh(signal, updateStatus);

    expect(mockMeshStart).toHaveBeenCalledTimes(1);
    expect(mockMeshBroadcast).toHaveBeenCalledTimes(1);

    const [payload] = mockMeshBroadcast.mock.calls[0] as [string];
    const parsed = JSON.parse(payload);
    expect(parsed.type).toBe('SOS');
    expect(parsed.from).toBe('install-abc');
    expect(parsed.senderUid).toBe(signal.userId);
    expect(updateStatus).toHaveBeenNthCalledWith(1, 'mesh', 'sending');
    expect(updateStatus).toHaveBeenLastCalledWith('mesh', 'sent');
  });
});
