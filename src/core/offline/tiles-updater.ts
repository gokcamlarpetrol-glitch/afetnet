import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { PreferencesManager } from '../storage/prefs';

export interface DownloadProgress {
  totalBytes: number;
  writtenBytes: number;
  percentage: number;
}

export class TilesUpdater {
  private static instance: TilesUpdater;
  private prefs = PreferencesManager.getInstance();
  private activeDownloads = new Map<string, any>();

  static getInstance(): TilesUpdater {
    if (!TilesUpdater.instance) {
      TilesUpdater.instance = new TilesUpdater();
    }
    return TilesUpdater.instance;
  }

  async downloadTiles(
    url: string,
    version: string,
    expectedSHA256: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const downloadId = `${version}-${Date.now()}`;
    const tempPath = `${FileSystem.documentDirectory}temp/istanbul-${version}.mbtiles`;
    const finalPath = `${FileSystem.documentDirectory}offline/istanbul-${version}.mbtiles`;

    try {
      console.log(`Starting tiles download: ${version} from ${url}`);

      // Ensure directories exist
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}temp`, { intermediates: true });
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}offline`, { intermediates: true });

      // Check if file already exists and is valid
      const fileInfo = await FileSystem.getInfoAsync(finalPath);
      if (fileInfo.exists) {
        const isValid = await this.verifyFileSHA256(finalPath, expectedSHA256);
        if (isValid) {
          console.log(`Tiles ${version} already exists and is valid`);
          onProgress?.(100);
          return;
        } else {
          console.log(`Existing tiles ${version} failed verification, re-downloading`);
          await FileSystem.deleteAsync(finalPath, { idempotent: true });
        }
      }

      // Check for partial download and resume if possible
      const tempInfo = await FileSystem.getInfoAsync(tempPath);
      let resumeData = null;
      if (tempInfo.exists) {
        resumeData = await this.getResumeData(tempPath);
        console.log(`Resuming download from byte ${resumeData?.writtenBytes || 0}`);
      }

      // Start download with resume support
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        tempPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesExpectedToWrite > 0
            ? (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
            : 0;
          onProgress?.(progress);
        },
        resumeData
      );

      // Store active download
      this.activeDownloads.set(downloadId, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      if (!result) {
        throw new Error('Download failed - no result');
      }

      // Verify downloaded file
      const isValid = await this.verifyFileSHA256(result.uri, expectedSHA256);
      if (!isValid) {
        throw new Error('Downloaded file failed SHA256 verification');
      }

      // Move to final location
      await FileSystem.moveAsync({
        from: result.uri,
        to: finalPath,
      });

      // Clean up temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });

      console.log(`Tiles ${version} downloaded and verified successfully`);
    } catch (error) {
      console.error(`Failed to download tiles ${version}:`, error);
      // Clean up on error
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      throw error;
    } finally {
      // Remove from active downloads
      this.activeDownloads.delete(downloadId);
    }
  }

  async verifyFileSHA256(filePath: string, expectedSHA256: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return false;
      }

      // Calculate SHA256 hash of the file
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.BASE64 }),
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      const isValid = hash.toLowerCase() === expectedSHA256.toLowerCase();
      console.log(`SHA256 verification for ${filePath}: ${isValid ? 'PASS' : 'FAIL'}`);
      console.log(`Expected: ${expectedSHA256.toLowerCase()}`);
      console.log(`Actual: ${hash.toLowerCase()}`);

      return isValid;
    } catch (error) {
      console.error('SHA256 verification failed:', error);
      return false;
    }
  }

  async installTiles(version: string): Promise<void> {
    const tilesPath = `${FileSystem.documentDirectory}offline/istanbul-${version}.mbtiles`;
    
    try {
      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(tilesPath);
      if (!fileInfo.exists) {
        throw new Error(`Tiles file for version ${version} not found`);
      }

      // Update active tiles pointer in preferences
      await this.prefs.set('activeTilesVersion', version);
      await this.prefs.set('activeTilesPath', tilesPath);

      console.log(`Tiles ${version} installed successfully`);
    } catch (error) {
      console.error(`Failed to install tiles ${version}:`, error);
      throw error;
    }
  }

  async getActiveTilesPath(): Promise<string | null> {
    try {
      const activePath = await this.prefs.get('activeTilesPath');
      if (!activePath) {
        return null;
      }

      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(activePath);
      if (!fileInfo.exists) {
        console.warn('Active tiles file no longer exists, clearing preference');
        await this.prefs.remove('activeTilesPath');
        await this.prefs.remove('activeTilesVersion');
        return null;
      }

      return activePath;
    } catch (error) {
      console.error('Failed to get active tiles path:', error);
      return null;
    }
  }

  async getActiveTilesVersion(): Promise<string | null> {
    try {
      return await this.prefs.get('activeTilesVersion');
    } catch (error) {
      console.error('Failed to get active tiles version:', error);
      return null;
    }
  }

  async getAvailableTilesVersions(): Promise<string[]> {
    try {
      const offlineDir = `${FileSystem.documentDirectory}offline`;
      const dirInfo = await FileSystem.getInfoAsync(offlineDir);
      
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(offlineDir);
      const versions = files
        .filter(file => file.startsWith('istanbul-') && file.endsWith('.mbtiles'))
        .map(file => file.replace('istanbul-', '').replace('.mbtiles', ''))
        .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

      return versions;
    } catch (error) {
      console.error('Failed to get available tiles versions:', error);
      return [];
    }
  }

  async deleteTilesVersion(version: string): Promise<void> {
    try {
      const tilesPath = `${FileSystem.documentDirectory}offline/istanbul-${version}.mbtiles`;
      await FileSystem.deleteAsync(tilesPath, { idempotent: true });
      
      // If this was the active version, clear the preference
      const activeVersion = await this.getActiveTilesVersion();
      if (activeVersion === version) {
        await this.prefs.remove('activeTilesPath');
        await this.prefs.remove('activeTilesVersion');
      }

      console.log(`Tiles version ${version} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete tiles version ${version}:`, error);
      throw error;
    }
  }

  async getTilesInfo(version: string): Promise<{ size: number; modified: Date } | null> {
    try {
      const tilesPath = `${FileSystem.documentDirectory}offline/istanbul-${version}.mbtiles`;
      const fileInfo = await FileSystem.getInfoAsync(tilesPath);
      
      if (!fileInfo.exists) {
        return null;
      }

      return {
        size: fileInfo.size || 0,
        modified: new Date(fileInfo.modificationTime || 0),
      };
    } catch (error) {
      console.error(`Failed to get tiles info for version ${version}:`, error);
      return null;
    }
  }

  private async getResumeData(filePath: string): Promise<any> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return null;
      }

      return {
        writtenBytes: fileInfo.size || 0,
      };
    } catch (error) {
      console.error('Failed to get resume data:', error);
      return null;
    }
  }

  async cancelDownload(downloadId: string): Promise<void> {
    const download = this.activeDownloads.get(downloadId);
    if (download) {
      try {
        await download.cancelAsync();
        console.log(`Download ${downloadId} cancelled`);
      } catch (error) {
        console.error(`Failed to cancel download ${downloadId}:`, error);
      } finally {
        this.activeDownloads.delete(downloadId);
      }
    }
  }

  async cancelAllDownloads(): Promise<void> {
    const promises = Array.from(this.activeDownloads.keys()).map(id => this.cancelDownload(id));
    await Promise.all(promises);
  }

  getActiveDownloadIds(): string[] {
    return Array.from(this.activeDownloads.keys());
  }
}
