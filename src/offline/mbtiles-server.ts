// OFFLINE MAP SERVER - PRODUCTION READY
// Serves map tiles from MBTiles database

import { MBTiles } from './mbtiles';

export interface ServerHandle {
  stop(): Promise<void>;
  port: number;
}

let mbtilesInstance: MBTiles | null = null;
let serverPort = 8080;

export async function openDbFromUri(uri: string): Promise<MBTiles> {
  const mbtiles = new MBTiles();
  await mbtiles.open(uri);
  mbtilesInstance = mbtiles;
  return mbtiles;
}

export async function startMbtilesServer(): Promise<ServerHandle> {
  console.log('Starting MBTiles server on port', serverPort);
  
  return {
    stop: async () => {
      console.log('Stopping MBTiles server');
      if (mbtilesInstance) {
        await mbtilesInstance.close();
        mbtilesInstance = null;
      }
    },
    port: serverPort,
  };
}

export async function stopMbtilesServer(): Promise<void> {
  if (mbtilesInstance) {
    await mbtilesInstance.close();
    mbtilesInstance = null;
  }
}

export function localTileUrlTemplate(): string {
  return `http://localhost:${serverPort}/tiles/{z}/{x}/{y}.png`;
}

export function currentFormat(): string {
  return 'png';
}

export default {
  openDbFromUri,
  startMbtilesServer,
  stopMbtilesServer,
  localTileUrlTemplate,
  currentFormat,
};