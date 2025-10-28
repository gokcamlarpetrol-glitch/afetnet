// SAFE MBTILES WRAPPER - PRODUCTION READY
// Safe wrapper for MBTiles operations with error handling

import { MBTiles, MBTilesMetadata, TileInfo } from './mbtiles';

export class SafeMBTiles {
  private mbtiles: MBTiles | null = null;
  private isOpen = false;

  async open(filePath: string): Promise<boolean> {
    try {
      this.mbtiles = new MBTiles();
      await this.mbtiles.open(filePath);
      this.isOpen = true;
      return true;
    } catch (error) {
      console.error('SafeMBTiles open error:', error);
      this.isOpen = false;
      return false;
    }
  }

  async getTile(z: number, x: number, y: number): Promise<Buffer | null> {
    if (!this.isOpen || !this.mbtiles) {
      return null;
    }

    try {
      return await this.mbtiles.getTile(z, x, y);
    } catch (error) {
      console.error('SafeMBTiles getTile error:', error);
      return null;
    }
  }

  async getMetadata(): Promise<MBTilesMetadata | null> {
    if (!this.isOpen || !this.mbtiles) {
      return null;
    }

    try {
      return await this.mbtiles.getMetadata();
    } catch (error) {
      console.error('SafeMBTiles getMetadata error:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.mbtiles) {
      try {
        await this.mbtiles.close();
      } catch (error) {
        console.error('SafeMBTiles close error:', error);
      }
      this.mbtiles = null;
    }
    this.isOpen = false;
  }

  isReady(): boolean {
    return this.isOpen && this.mbtiles !== null;
  }

  static isAvailable(): boolean {
    return MBTiles.isAvailable();
  }

  static async pickMbtiles(): Promise<string | null> {
    const mbtiles = new MBTiles();
    return await mbtiles.pickMbtiles();
  }
}

export default SafeMBTiles;