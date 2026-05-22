/**
 * Tests for secureId utility — verify collision resistance, format invariants,
 * and RFC4122 compliance for UUID v4.
 */

import { secureId, secureIdAsync, secureMessageId, secureUUIDv4 } from '../secureId';

// Mock expo-crypto with a strong PRNG (xorshift64) seeded uniquely per call.
// We don't use real crypto in test (RN test env can't bind), but a 64-bit
// PRNG with monotonic seeding gives non-colliding output for 1000+ calls.
jest.mock('expo-crypto', () => {
  let seed = 1n;
  function nextByte(): number {
    // xorshift64
    seed ^= seed << 13n;
    seed &= 0xffffffffffffffffn;
    seed ^= seed >> 7n;
    seed ^= seed << 17n;
    seed &= 0xffffffffffffffffn;
    return Number(seed & 0xffn);
  }
  return {
    getRandomBytes: jest.fn((n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = nextByte();
      return out;
    }),
    getRandomBytesAsync: jest.fn(async (n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = nextByte();
      return out;
    }),
  };
});

describe('secureId', () => {
  it('returns a base62 string', () => {
    const id = secureId(8);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('produces non-empty output', () => {
    expect(secureId(8).length).toBeGreaterThan(0);
  });

  it('respects byte length (longer bytes → longer ID)', () => {
    // Force counter so first byte is non-zero
    const short = secureId(1);
    const long = secureId(16);
    expect(long.length).toBeGreaterThanOrEqual(short.length);
  });

  it('does not collide across 1000 generations (sanity)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(secureId(8));
    expect(set.size).toBe(1000);
  });
});

describe('secureIdAsync', () => {
  it('resolves with base62 string', async () => {
    const id = await secureIdAsync(8);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('secureMessageId', () => {
  it('includes prefix when provided', () => {
    const id = secureMessageId('msg');
    expect(id.startsWith('msg_')).toBe(true);
  });

  it('omits prefix when not provided', () => {
    const id = secureMessageId();
    expect(id).not.toContain('msg_');
    expect(id.split('_').length).toBe(2);
  });

  it('contains timestamp in base36 form', () => {
    const id = secureMessageId('test');
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('test');
    // base36 timestamps don't contain underscores
    expect(parts[1]).toMatch(/^[0-9a-z]+$/);
  });
});

describe('secureUUIDv4', () => {
  it('matches RFC4122 v4 format', () => {
    const uuid = secureUUIDv4();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('sets the version nibble to 4', () => {
    const uuid = secureUUIDv4();
    // version is the first char of group 3
    expect(uuid.split('-')[2]?.[0]).toBe('4');
  });

  it('sets the variant nibble to 8, 9, a, or b', () => {
    const uuid = secureUUIDv4();
    const variantChar = uuid.split('-')[3]?.[0];
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });
});
