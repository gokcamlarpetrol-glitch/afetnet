/**
 * Convert lat/lon to local tangent ENU (East-North-Up) in meters relative to origin (lat0, lon0).
 * Good for distances < ~50 km.
 */
const R = 6378137; // Earth radius (m)

export type Origin = { lat0:number; lon0:number };

export function toENU(lat:number, lon:number, origin:Origin){
  const dLat = (lat - origin.lat0) * Math.PI/180;
  const dLon = (lon - origin.lon0) * Math.PI/180;
  const lat0r = origin.lat0*Math.PI/180;
  const x = dLon * Math.cos(lat0r) * R; // east
  const y = dLat * R;                   // north
  return { x, y };
}



