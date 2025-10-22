// TILES UTILITY - PRODUCTION READY
// Utility functions for tile operations

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export function deg2num(lat: number, lon: number, zoom: number): TileCoord {
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
  
  return { z: zoom, x, y };
}

export function num2deg(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const n = Math.pow(2, zoom);
  const lonDeg = x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const latDeg = latRad * 180 / Math.PI;
  
  return { lat: latDeg, lon: lonDeg };
}

export function getTileBounds(x: number, y: number, zoom: number): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  const nw = num2deg(x, y, zoom);
  const se = num2deg(x + 1, y + 1, zoom);
  
  return {
    north: nw.lat,
    south: se.lat,
    east: se.lon,
    west: nw.lon,
  };
}

export function getTilesInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number,
): TileCoord[] {
  const tiles: TileCoord[] = [];
  
  const minTile = deg2num(bounds.north, bounds.west, zoom);
  const maxTile = deg2num(bounds.south, bounds.east, zoom);
  
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  
  return tiles;
}

export default {
  deg2num,
  num2deg,
  getTileBounds,
  getTilesInBounds,
};
