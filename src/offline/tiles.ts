import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

export const tileRoot = `${FileSystem.documentDirectory}tiles/`;
export const remoteTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

export function tilesForBBox(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }, minZoom: number, maxZoom: number): { x: number; y: number; z: number }[] {
  const tiles: { x: number; y: number; z: number }[] = [];
  
  for (let z = minZoom; z <= maxZoom; z++) {
    const minTile = latLonToTile(bbox.maxLat, bbox.minLon, z);
    const maxTile = latLonToTile(bbox.minLat, bbox.maxLon, z);
    
    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ x, y, z });
      }
    }
  }
  
  return tiles;
}

export function tilePath(x: number, y: number, zoom: number): string {
  return `${tileRoot}${zoom}/${x}/${y}.png`;
}

export async function ensureDirs(): Promise<void> {
  const dirs = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
  
  for (const dir of dirs) {
    const path = dir === '' ? tileRoot : `${tileRoot}${dir}/`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
  }
}

export async function exists(x: number, y: number, zoom: number): Promise<boolean> {
  const path = tilePath(x, y, zoom);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

export async function prefetchTiles(
  centerLat: number, 
  centerLon: number, 
  radiusKm: number, 
  minZoom: number, 
  maxZoom: number,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) {
    throw new Error('İnternet bağlantısı yok');
  }
  
  await ensureDirs();
  
  const radiusDegrees = radiusKm / 111.32; // Rough conversion
  const minLat = centerLat - radiusDegrees;
  const maxLat = centerLat + radiusDegrees;
  const minLon = centerLon - radiusDegrees / Math.cos(centerLat * Math.PI / 180);
  const maxLon = centerLon + radiusDegrees / Math.cos(centerLat * Math.PI / 180);
  
  const allTiles: { x: number; y: number; z: number }[] = [];
  
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const tiles = tilesForBBox(minLat, minLon, maxLat, maxLon, zoom);
    allTiles.push(...tiles.map(tile => ({ ...tile, z: zoom })));
  }
  
  let downloaded = 0;
  const total = allTiles.length;
  
  for (const tile of allTiles) {
    const existsAlready = await exists(tile.x, tile.y, tile.z);
    if (existsAlready) {
      downloaded++;
      onProgress?.(downloaded, total);
      continue;
    }
    
    const url = remoteTemplate.replace('{x}', tile.x.toString()).replace('{y}', tile.y.toString()).replace('{z}', tile.z.toString());
    const path = tilePath(tile.x, tile.y, tile.z);
    
    try {
      await FileSystem.downloadAsync(url, path);
      downloaded++;
      onProgress?.(downloaded, total);
    } catch (error) {
      console.warn(`Failed to download tile ${tile.x}/${tile.y}/${tile.z}:`, error);
      // Continue with next tile
    }
  }
}

export async function cacheSizeBytes(): Promise<number> {
  const info = await FileSystem.getInfoAsync(tileRoot);
  if (!info.exists) return 0;
  
  let totalSize = 0;
  
  const calculateDirSize = async (dirPath: string): Promise<number> => {
    const files = await FileSystem.readDirectoryAsync(dirPath);
    let dirSize = 0;
    
    for (const file of files) {
      const filePath = `${dirPath}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists) {
        if (fileInfo.isDirectory) {
          dirSize += await calculateDirSize(`${filePath}/`);
        } else {
          dirSize += fileInfo.size || 0;
        }
      }
    }
    
    return dirSize;
  };
  
  totalSize = await calculateDirSize(tileRoot);
  return totalSize;
}
