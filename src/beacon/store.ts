import * as FileSystem from "expo-file-system";
import { Beacon } from "./model";

const DIR = "/tmp/";
const FILE = DIR + "beacons.json";

type FileShape = { items: Beacon[] };

async function read(): Promise<FileShape>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return { items: [] };}
  try{
    const txt = await FileSystem.readAsStringAsync(FILE);
    const data = JSON.parse(txt);
    return Array.isArray(data?.items) ? data : { items: [] };
  }catch{ return { items: [] }; }
}

async function write(items: Beacon[]){
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify({items}));
}

export async function listBeacons(now = Date.now()){
  const data = await read();
  // purge expired
  const keep = data.items.filter(b => (now - b.ts) <= (b.ttlSec*1000));
  if(keep.length !== data.items.length){ await write(keep); }
  return keep;
}

export async function upsertBeacon(b: Beacon){
  const items = await listBeacons();
  const idx = items.findIndex(x => x.id === b.id);
  if(idx>=0) {items[idx] = b;} else {items.push(b);}
  await write(items);
  return b;
}
