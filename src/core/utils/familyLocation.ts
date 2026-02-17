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

const isValidCoordinatePair = (latitude: unknown, longitude: unknown): latitude is number & typeof longitude => {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Treat (0,0) as uninitialized app data for this domain.
  if (latitude === 0 && longitude === 0) return false;
  return true;
};

export const resolveFamilyMemberLocation = (
  member: FamilyLocationLike,
): ResolvedFamilyLocation | null => {
  const liveLatitude = member.location?.latitude;
  const liveLongitude = member.location?.longitude;
  if (isValidCoordinatePair(liveLatitude, liveLongitude)) {
    return {
      latitude: liveLatitude,
      longitude: liveLongitude,
      ...(isFiniteCoordinate(member.location?.accuracy) ? { accuracy: member.location?.accuracy } : {}),
      ...(member.location?.timestamp ? { timestamp: member.location.timestamp } : {}),
      source: 'live',
    };
  }

  const legacyLatitude = member.latitude;
  const legacyLongitude = member.longitude;
  if (isValidCoordinatePair(legacyLatitude, legacyLongitude)) {
    return {
      latitude: legacyLatitude,
      longitude: legacyLongitude,
      source: 'legacy',
    };
  }

  const lastKnownLatitude = member.lastKnownLocation?.latitude;
  const lastKnownLongitude = member.lastKnownLocation?.longitude;
  if (isValidCoordinatePair(lastKnownLatitude, lastKnownLongitude)) {
    return {
      latitude: lastKnownLatitude,
      longitude: lastKnownLongitude,
      ...(member.lastKnownLocation?.timestamp ? { timestamp: member.lastKnownLocation.timestamp } : {}),
      source: 'lastKnown',
    };
  }

  return null;
};

export const hasFamilyMemberLocation = (member: FamilyLocationLike): boolean =>
  !!resolveFamilyMemberLocation(member);
