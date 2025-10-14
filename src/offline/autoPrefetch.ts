import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { AUTO_PREFETCH_KM, AUTO_PREFETCH_ZOOMS, REMOTE_S2_TEMPLATE } from "../config/mapBootstrap";
import { logger } from '../utils/productionLogger';
import { tileManager } from "./tileManager";
import { tilesForBBox } from "./tiles";

function bboxFromCenter(lat: number, lon: number, km: number) {
  const d = km / 111;
  return { minLat: lat - d, minLon: lon - d, maxLat: lat + d, maxLon: lon + d };
}

export async function autoPrefetchSmallSatellite(): Promise<boolean> {
  try {
    if (!REMOTE_S2_TEMPLATE) {
      logger.debug('Auto-prefetch disabled: REMOTE_S2_TEMPLATE not configured');
      return false; // Disabled by default for legal safety
    }
    
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      logger.debug('Auto-prefetch skipped: no network connection');
      return false;
    }
    
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      logger.debug('Auto-prefetch skipped: no location permission');
      return false;
    }
    
    const loc = await Location.getCurrentPositionAsync({});
    const box = bboxFromCenter(loc.coords.latitude, loc.coords.longitude, AUTO_PREFETCH_KM);
    
    const dstRoot = await tileManager.ensurePackDir("sentinel-auto");
    
    let downloadedTiles = 0;
    let totalTiles = 0;
    
    // Calculate total tiles first
    for (const zoom of AUTO_PREFETCH_ZOOMS) {
      const tiles = tilesForBBox(box, zoom, zoom);
      totalTiles += tiles.length;
    }
    
    logger.debug(`Auto-prefetch: downloading ${totalTiles} tiles for ${AUTO_PREFETCH_KM}km radius`);
    
    for (const zoom of AUTO_PREFETCH_ZOOMS) {
      const tiles = tilesForBBox(box, zoom, zoom);
      
      for (const tile of tiles) {
        const url = (REMOTE_S2_TEMPLATE as string)
          .replace("{z}", String(tile.z))
          .replace("{x}", String(tile.x))
          .replace("{y}", String(tile.y));
        
        const dst = `${dstRoot}${tile.z}/${tile.x}/${tile.y}.jpg`;
        
        try {
          await FileSystem.makeDirectoryAsync(`${dstRoot}${tile.z}/${tile.x}`, { intermediates: true });
          
          const info = await FileSystem.getInfoAsync(dst).catch(() => ({ exists: false }));
          if (!info.exists) {
            try {
              await FileSystem.downloadAsync(url, dst);
              downloadedTiles++;
            } catch (downloadError) {
              logger.warn(`Failed to download tile ${url}:`, downloadError);
              // Continue with other tiles
            }
          }
        } catch (error) {
          logger.warn(`Failed to process tile ${tile.z}/${tile.x}/${tile.y}:`, error);
        }
        
        // Yield control every 10 tiles
        if ((downloadedTiles % 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    
    if (downloadedTiles > 0) {
      await tileManager.registerFolderPack("sentinel-auto", dstRoot, "raster", AUTO_PREFETCH_ZOOMS);
      logger.debug(`Auto-prefetch completed: ${downloadedTiles}/${totalTiles} tiles downloaded`);
      return true;
    } else {
      logger.debug('Auto-prefetch failed: no tiles downloaded');
      return false;
    }
  } catch (error) {
    logger.warn('Auto-prefetch failed:', error);
    return false;
  }
}