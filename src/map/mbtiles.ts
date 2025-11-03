import { SafeSQLite } from '../db/SafeSQLite';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MBTILES_PATH_KEY = 'afetnet/mbtiles_path';

export type TileReq = { z:number; x:number; y:number };

export class MBTiles {
  private db: any;
  constructor(path:string){ this.db = SafeSQLite.openDatabase({ name: path, location: 'default' }); }

  async getTile(req:TileReq): Promise<Uint8Array|null>{
    return new Promise((resolve)=>{
      this.db.readTransaction((tx:any)=>{
        tx.executeSql('SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?', 
          [req.z, req.x, (1<<req.z)-1-req.y], // TMS vs XYZ flip
          (_:any,rs:any)=>{ if(rs.rows.length){ const b=rs.rows.item(0).tile_data as string; resolve(decode(b)); } else {resolve(null);} },
        );
      });
    });
  }
}

function decode(base64:string){
  const bin=globalThis.atob(base64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) {arr[i]=bin.charCodeAt(i);}
  return arr;
}

export async function selectMBTiles(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const path = result.assets[0].uri;
      await AsyncStorage.setItem(MBTILES_PATH_KEY, path);
      return path;
    }
  } catch (err) {
    console.error('Error selecting MBTiles file:', err);
  }
  return null;
}

export async function getMBTilesPath(): Promise<string | null> {
  return AsyncStorage.getItem(MBTILES_PATH_KEY);
}

export async function clearMBTilesPath(): Promise<void> {
  await AsyncStorage.removeItem(MBTILES_PATH_KEY);
}
