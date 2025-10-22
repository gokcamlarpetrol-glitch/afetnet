import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import * as FileSystem from 'expo-file-system';
import { BOOT_KEY } from '../config/mapBootstrap';
import { tileManager } from './tileManager';

export async function tryInstallStarterSatellite(): Promise<boolean> {
  try {
    const boot = await AsyncStorage.getItem(BOOT_KEY);
    if (boot === 'done') return false;
    
    const dst = await tileManager.ensurePackDir('sentinel-starter');
    
    // Check if bundled asset exists
    const assetFolder = (FileSystem.bundleDirectory || '') + 'assets/tiles/sentinel-starter/';
    const assetInfo = await FileSystem.getInfoAsync(assetFolder).catch(() => ({ exists: false }));
    
    if (!assetInfo.exists) {
      return false; // No starter pack available
    }

    // Copy bundled starter pack to documents recursively
    await copyTree(assetFolder, dst);
    
    // Register the pack
    await tileManager.registerFolderPack('sentinel-starter', dst, 'raster', [12, 13, 14, 15]);
    
    // Mark as done
    await AsyncStorage.setItem(BOOT_KEY, 'done');
    logger.debug('Starter satellite pack installed successfully');
    return true;
  } catch (error) {
    logger.warn('Failed to install starter satellite pack:', error);
    return false;
  }
}

async function copyTree(src: string, dstRoot: string): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(src);
    
    for (const name of names) {
      const srcPath = src + name;
      const dstPath = dstRoot + name;
      
      try {
        const info = await FileSystem.getInfoAsync(srcPath);
        
        if (info.isDirectory) {
          await FileSystem.makeDirectoryAsync(dstPath, { intermediates: true });
          await copyTree(srcPath + '/', dstPath + '/');
        } else {
          await FileSystem.copyAsync({ from: srcPath, to: dstPath });
        }
      } catch (copyError) {
        logger.warn(`Failed to copy ${srcPath}:`, copyError);
        // Continue with other files
      }
    }
  } catch (error) {
    logger.warn('Failed to copy tree:', error);
    throw error;
  }
}