import { Buffer } from 'buffer';
import { MeshMessageType, MeshProtocol } from '../MeshProtocol';

describe('MeshProtocol compatibility', () => {
  it('round-trips packet with serialize/deserialize', () => {
    const sourceId = 'AFN-TEST1234';
    const payload = Buffer.from('mesh-compatibility-check', 'utf8');

    const packet = MeshProtocol.serialize(
      MeshMessageType.TEXT,
      sourceId,
      payload,
      3,
      95,
      0x1234abcd
    );

    const decoded = MeshProtocol.deserialize(packet);
    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(MeshMessageType.TEXT);
    expect(decoded?.header.ttl).toBe(3);
    expect(decoded?.header.qScore).toBe(95);
    expect(decoded?.header.messageId).toBe(0x1234abcd);
    expect(decoded?.payload.toString('utf8')).toBe('mesh-compatibility-check');
  });

  it('keeps compatibility across BLE hex/base64 transformation', () => {
    const payload = Buffer.from('via-ble-manufacturer-data', 'utf8');
    const serialized = MeshProtocol.serialize(
      MeshMessageType.SOS,
      'AFN-BLEFLOW01',
      payload,
      2,
      100,
      0xdeadbeef
    );

    // Same path as advertising + scanning:
    // bytes -> hex (advertising) and base64 -> hex (scan callback)
    const advertisedHex = Buffer.from(serialized).toString('hex');
    const discoveredBase64 = Buffer.from(advertisedHex, 'hex').toString('base64');
    const scannedHex = Buffer.from(discoveredBase64, 'base64').toString('hex');

    const decoded = MeshProtocol.deserialize(Buffer.from(scannedHex, 'hex'));
    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(MeshMessageType.SOS);
    expect(decoded?.header.messageId).toBe(0xdeadbeef);
    expect(decoded?.payload.toString('utf8')).toBe('via-ble-manufacturer-data');
  });

  it('returns null for malformed payload', () => {
    const malformed = Buffer.from([0x00, 0x01, 0x02]);
    expect(MeshProtocol.deserialize(malformed)).toBeNull();
  });
});
