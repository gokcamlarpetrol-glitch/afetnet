import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SafeSQLite } from '../db/SafeSQLite';

type Meta = { name?: string; format?: 'png'|'jpg'|'pbf'; minzoom?: number; maxzoom?: number };

export async function pickMbtiles(){
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) {throw new Error('cancelled');}
  return res.assets[0].uri;
}

export async function inspectMbtiles(uri: string): Promise<Meta> {
  const db = await SafeSQLite.openDatabase({ name: uri, location: 'default', createFromLocation: uri });
  const metaRows = await db.executeSql('SELECT name, value FROM metadata');
  const m: Record<string,string> = {};
  for (const r of metaRows[0].rows.raw()){ m[r.name] = r.value; }
  const format = (m.format as any) || 'png';
  const minzoom = Number(m.minzoom ?? 0), maxzoom = Number(m.maxzoom ?? 5);
  await db.close();
  return { name: m.name, format: format, minzoom, maxzoom };
}

/** Extracts ALL tiles (can be large!). For demo we cap at max 30k files. Returns rootDir. */
export async function extractTiles(uri: string, rootDir?: string){
  const outRoot = rootDir || '/tmp/tiles/';
  await FileSystem.makeDirectoryAsync(outRoot, { intermediates: true }).catch(()=>{});
  const db = await SafeSQLite.openDatabase({ name: uri, location: 'default', createFromLocation: uri });

  // MBTiles schema: tiles(z INTEGER, x INTEGER, y INTEGER, tile_data BLOB)
  const fmtRes = await db.executeSql('SELECT value FROM metadata WHERE name=\'format\'');
  const fmt = (fmtRes[0].rows.length ? fmtRes[0].rows.item(0).value : 'png') as 'png'|'jpg'|'pbf';

  const page = 2000;
  let total = 0;
  let offset = 0;
  // Try count
  try {
    const cnt = await db.executeSql('SELECT COUNT(1) as c FROM tiles');
    total = cnt[0].rows.item(0).c;
  } catch {
    // Ignore database count errors
  }

  const limit = Math.min(total || 1000000, 30000); // safety cap
  while (offset < limit) {
    const res = await db.executeSql(`SELECT zoom_level z, tile_column x, tile_row y, tile_data d FROM tiles LIMIT ${page} OFFSET ${offset}`);
    const rows = res[0].rows;
    for (let i=0;i<rows.length;i++){
      const { z, x } = rows.item(i);
      // MBTiles uses TMS y; convert to XYZ: y = (2^z - 1) - y
      const yTms = rows.item(i).y;
      const y = (1<<z) - 1 - yTms;
      const dir = `${outRoot}${z}/${x}/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(()=>{});
      const path = `${dir}${y}.${fmt}`;
      // Write tile
      const base64 = (globalThis as any).Buffer.from(rows.item(i).d, 'base64').toString('base64');
      await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
    }
    offset += rows.length;
    if (rows.length === 0) {break;}
  }
  await db.close();
  return { root: outRoot, format: fmt };
}

export function tileUrlTemplate(root: string, fmt: 'png'|'jpg'|'pbf'){
  // expo-maps tile overlay: file:// path template
  const prefix = root.startsWith('file://') ? root : ('file://' + root);
  return `${prefix}{z}/{x}/{y}.${fmt}`;
}
