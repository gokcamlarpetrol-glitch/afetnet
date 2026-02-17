import { hasFamilyMemberLocation, resolveFamilyMemberLocation } from '../familyLocation';

describe('familyLocation resolver', () => {
  it('uses live location when present', () => {
    const resolved = resolveFamilyMemberLocation({
      latitude: 0,
      longitude: 0,
      location: {
        latitude: 41.0082,
        longitude: 28.9784,
        accuracy: 12,
        timestamp: 1_770_000_000_000,
      },
      lastKnownLocation: {
        latitude: 40.0,
        longitude: 29.0,
        timestamp: 1_760_000_000_000,
      },
    });

    expect(resolved).toEqual({
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 12,
      timestamp: 1_770_000_000_000,
      source: 'live',
    });
  });

  it('falls back to legacy latitude/longitude when live location is missing', () => {
    const resolved = resolveFamilyMemberLocation({
      latitude: 39.9334,
      longitude: 32.8597,
      location: undefined,
      lastKnownLocation: undefined,
    });

    expect(resolved).toEqual({
      latitude: 39.9334,
      longitude: 32.8597,
      source: 'legacy',
    });
  });

  it('uses last known location when live/legacy coordinates are unavailable', () => {
    const resolved = resolveFamilyMemberLocation({
      latitude: 0,
      longitude: 0,
      location: {
        latitude: 0,
        longitude: 0,
      },
      lastKnownLocation: {
        latitude: 37.8667,
        longitude: 32.4833,
        timestamp: 1_750_000_000_000,
      },
    });

    expect(resolved).toEqual({
      latitude: 37.8667,
      longitude: 32.4833,
      timestamp: 1_750_000_000_000,
      source: 'lastKnown',
    });
    expect(hasFamilyMemberLocation({
      latitude: 0,
      longitude: 0,
      lastKnownLocation: {
        latitude: 37.8667,
        longitude: 32.4833,
        timestamp: 1_750_000_000_000,
      },
    })).toBe(true);
  });

  it('returns null for invalid coordinates', () => {
    expect(resolveFamilyMemberLocation({
      latitude: 200,
      longitude: 300,
      location: { latitude: 95, longitude: 181 },
      lastKnownLocation: { latitude: 0, longitude: 0 },
    })).toBeNull();
    expect(hasFamilyMemberLocation({
      latitude: 0,
      longitude: 0,
      location: { latitude: 0, longitude: 0 },
    })).toBe(false);
  });
});
