/**
 * FAMILY LOCATION UTILITIES
 * Shared resolver for live/legacy/last-known member coordinates.
 */

export type FamilyLocationLike = {
  latitude?: number | null;
  longitude?: number | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    timestamp?: number | string | Date | null;
  } | null;
  lastKnownLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    timestamp?: number | string | Date | null;
  } | null;
};

export type ResolvedFamilyLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number | string | Date;
  source: 'live' | 'legacy' | 'lastKnown';
};

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const isValidCoordinatePair = (latitude: unknown, longitude: unknown): latitude is number & typeof longitude => {
  const latNum = isFiniteCoordinate(latitude) ? latitude : toNumber(latitude);
  const lonNum = isFiniteCoordinate(longitude) ? longitude : toNumber(longitude);
  if (!isFiniteCoordinate(latNum) || !isFiniteCoordinate(lonNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;
  // Treat (0,0) as uninitialized app data for this domain.
  if (latNum === 0 && lonNum === 0) return false;
  return true;
};

export const resolveFamilyMemberLocation = (
  member: FamilyLocationLike,
): ResolvedFamilyLocation | null => {
  const liveLatitude = member.location?.latitude;
  const liveLongitude = member.location?.longitude;
  if (isValidCoordinatePair(liveLatitude, liveLongitude)) {
    const lat = toNumber(liveLatitude) ?? (liveLatitude as number);
    const lon = toNumber(liveLongitude) ?? (liveLongitude as number);
    return {
      latitude: lat as number,
      longitude: lon as number,
      ...(isFiniteCoordinate(member.location?.accuracy) ? { accuracy: member.location?.accuracy } : {}),
      ...(member.location?.timestamp ? { timestamp: member.location.timestamp } : {}),
      source: 'live',
    };
  }

  const lastKnownLatitude = member.lastKnownLocation?.latitude;
  const lastKnownLongitude = member.lastKnownLocation?.longitude;
  if (isValidCoordinatePair(lastKnownLatitude, lastKnownLongitude)) {
    const lat = toNumber(lastKnownLatitude) ?? (lastKnownLatitude as number);
    const lon = toNumber(lastKnownLongitude) ?? (lastKnownLongitude as number);
    return {
      latitude: lat as number,
      longitude: lon as number,
      ...(member.lastKnownLocation?.timestamp ? { timestamp: member.lastKnownLocation.timestamp } : {}),
      source: 'lastKnown',
    };
  }

  const legacyLatitude = member.latitude;
  const legacyLongitude = member.longitude;
  if (isValidCoordinatePair(legacyLatitude, legacyLongitude)) {
    const lat = toNumber(legacyLatitude) ?? (legacyLatitude as number);
    const lon = toNumber(legacyLongitude) ?? (legacyLongitude as number);
    return {
      latitude: lat as number,
      longitude: lon as number,
      source: 'legacy',
    };
  }

  return null;
};

export const hasFamilyMemberLocation = (member: FamilyLocationLike): boolean =>
  !!resolveFamilyMemberLocation(member);
