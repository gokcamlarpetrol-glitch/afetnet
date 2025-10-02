import { CBOREncoder } from '../core/crypto/cbor';

describe('CBOR Encoding/Decoding', () => {
  it('should encode and decode a simple message', () => {
    const message = {
      type: 'HELP_REQUEST',
      lat: 41.0082,
      lon: 28.9784,
      priority: 2,
      ttl: 6,
      ts: Date.now(),
    };

    const encoded = CBOREncoder.encode(message);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = CBOREncoder.decode(encoded);
    expect(decoded).toEqual(message);
  });

  it('should handle nested objects', () => {
    const message = {
      type: 'HELP_REQUEST',
      location: {
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
      },
      conditions: {
        underRubble: true,
        injured: false,
        peopleCount: 3,
      },
      ttl: 6,
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded).toEqual(message);
  });

  it('should handle arrays', () => {
    const message = {
      type: 'BATCH',
      messages: [
        { type: 'PING', lat: 41.0, lon: 28.9, ttl: 1 },
        { type: 'PING', lat: 41.1, lon: 28.8, ttl: 1 },
      ],
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded).toEqual(message);
  });

  it('should handle null and undefined values', () => {
    const message = {
      type: 'STATUS_PING',
      note: null,
      battery: undefined,
      lat: 41.0082,
      lon: 28.9784,
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded.type).toBe('STATUS_PING');
    expect(decoded.lat).toBe(41.0082);
    expect(decoded.lon).toBe(28.9784);
  });

  it('should produce compact output', () => {
    const message = {
      type: 'HELP_REQUEST',
      lat: 41.0082,
      lon: 28.9784,
      priority: 2,
      underRubble: true,
      injured: false,
      peopleCount: 1,
      ttl: 6,
      ts: Date.now(),
    };

    const encoded = CBOREncoder.encode(message);
    const jsonString = JSON.stringify(message);

    // CBOR should be more compact than JSON
    expect(encoded.length).toBeLessThan(jsonString.length);
    expect(encoded.length).toBeLessThan(200); // Target size
  });

  it('should handle boolean values correctly', () => {
    const message = {
      underRubble: true,
      injured: false,
      anonymity: true,
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded.underRubble).toBe(true);
    expect(decoded.injured).toBe(false);
    expect(decoded.anonymity).toBe(true);
  });

  it('should handle large numbers', () => {
    const message = {
      timestamp: Date.now(),
      largeNumber: 9007199254740991, // Max safe integer
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded.timestamp).toBe(message.timestamp);
    expect(decoded.largeNumber).toBe(message.largeNumber);
  });

  it('should handle empty objects and arrays', () => {
    const message = {
      emptyObject: {},
      emptyArray: [],
    };

    const encoded = CBOREncoder.encode(message);
    const decoded = CBOREncoder.decode(encoded);
    expect(decoded.emptyObject).toEqual({});
    expect(decoded.emptyArray).toEqual([]);
  });

  it('should be idempotent', () => {
    const message = {
      type: 'RESOURCE_POST',
      resourceType: 'water',
      qty: '10L',
      lat: 41.0082,
      lon: 28.9784,
    };

    const encoded1 = CBOREncoder.encode(message);
    const decoded1 = CBOREncoder.decode(encoded1);
    const encoded2 = CBOREncoder.encode(decoded1);
    const decoded2 = CBOREncoder.decode(encoded2);

    expect(decoded1).toEqual(decoded2);
    expect(Array.from(encoded1)).toEqual(Array.from(encoded2));
  });
});
