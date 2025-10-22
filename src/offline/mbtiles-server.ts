import { SafeMBTiles } from './SafeMBTiles';
// import * as FileSystem from 'expo-file-system'; // Not used

type ServerHandle = { close: ()=>void };
// const db: any = null; // Not used

function _httpResp(_status:number, _headers:Record<string,string>, _body:Uint8Array|string){
  // Implementation removed as it's not used
}

export async function openDbFromUri(uri: string){
  return SafeMBTiles.openDbFromUri(uri);
}

// Removed unused functions: readTile, parsePath

export async function startMbtilesServer(): Promise<ServerHandle> {
  return SafeMBTiles.startMbtilesServer();
}

export async function stopMbtilesServer(){ return SafeMBTiles.stopMbtilesServer(); }

export function localTileUrlTemplate(){
  return SafeMBTiles.localTileUrlTemplate();
}

export function currentFormat(){ return SafeMBTiles.currentFormat(); }
