import { highPerformanceBle } from '../HighPerformanceBle';

describe('HighPerformanceBle discovery routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts filtered-scan peers even when serviceUUID payload is missing', () => {
    const ble = highPerformanceBle as any;
    ble.useBroadScanFallback = false;
    ble.foundPeers.clear();
    ble.connectedPeers.clear();
    ble.connectionInProgress.clear();

    const connectSpy = jest.spyOn(ble, 'connectToPeer').mockResolvedValue(true);

    ble.processDiscoveredDevice({
      id: 'peer-filtered-1',
      rssi: -62,
      serviceUUIDs: null,
      manufacturerData: null,
      name: null,
      localName: null,
    });

    const peerExists = ble.foundPeers.has('peer-filtered-1');
    expect(peerExists).toBe(true);
    expect(connectSpy).toHaveBeenCalledWith('peer-filtered-1');
  });

  it('does not accept unrelated devices during broad fallback scan', () => {
    const ble = highPerformanceBle as any;
    ble.useBroadScanFallback = true;
    ble.foundPeers.clear();

    const connectSpy = jest.spyOn(ble, 'connectToPeer').mockResolvedValue(true);

    ble.processDiscoveredDevice({
      id: 'random-device',
      rssi: -80,
      serviceUUIDs: [],
      manufacturerData: null,
      name: 'Random',
      localName: 'Random',
    });

    const peerExists = ble.foundPeers.has('random-device');
    expect(peerExists).toBe(false);
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
