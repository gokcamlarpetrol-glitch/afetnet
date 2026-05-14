const mockNetInfoFetch = jest.fn();
const mockMeshBroadcast = jest.fn();
const mockMeshStart = jest.fn();
const mockMeshIsRunning = jest.fn();
let mockMeshPeers: Array<{ id: string }> = [{ id: 'peer-1' }];

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockNetInfoFetch(...args),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(async () => 0.8),
  getBatteryStateAsync: jest.fn(async () => 1),
  BatteryState: {
    CHARGING: 1,
  },
}));

jest.mock('../mesh/MeshStore', () => ({
  useMeshStore: {
    getState: jest.fn(() => ({ peers: mockMeshPeers })),
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
    mockMeshPeers = [{ id: 'peer-1' }];
    mockMeshIsRunning.mockReturnValue(false);
    mockMeshStart.mockResolvedValue(undefined);
    mockMeshBroadcast.mockResolvedValue(undefined);
  });

  it('does not mark firebase sent while offline', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      type: 'none',
    });

    const updateStatus = jest.fn();
    await expect((sosChannelRouter as any).broadcastViaFirebase(signal, updateStatus))
      .rejects
      .toThrow(/offline/i);

    // Firestore is not a durable SOS outbox in this app; cloud retry handles reconnect.
    expect(updateStatus).toHaveBeenNthCalledWith(1, 'firebase', 'pending');
    expect(updateStatus).toHaveBeenNthCalledWith(2, 'firebase', 'sending');
    expect(updateStatus).toHaveBeenLastCalledWith('firebase', 'failed');
  });

  it('broadcasts SOS over mesh with installation-scoped sender id', async () => {
    const updateStatus = jest.fn();
    jest
      .spyOn(sosChannelRouter as any, 'loadMeshDependencies')
      .mockResolvedValue(buildMeshDependencies());
    jest
      .spyOn(sosChannelRouter as any, 'getVisibleMeshPeerCount')
      .mockResolvedValue(1);

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

  it('does not mark mesh as sent when no peer is visible after queueing', async () => {
    mockMeshPeers = [];
    const updateStatus = jest.fn();
    jest
      .spyOn(sosChannelRouter as any, 'loadMeshDependencies')
      .mockResolvedValue(buildMeshDependencies());
    jest
      .spyOn(sosChannelRouter as any, 'getVisibleMeshPeerCount')
      .mockResolvedValue(0);

    await expect((sosChannelRouter as any).broadcastViaMesh(signal, updateStatus))
      .rejects
      .toThrow(/no visible peers/i);

    expect(mockMeshBroadcast).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenNthCalledWith(1, 'mesh', 'sending');
    expect(updateStatus).toHaveBeenLastCalledWith('mesh', 'failed');
  });
});
