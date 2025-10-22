import * as FileSystem from 'expo-file-system';
import { cellFor } from '../geo/grid';
import { LItem } from './types';

const DIR = '/tmp/';
const FILE = DIR + 'logistics.json';

export type CellAgg = {
  key: string;
  glat: number; glng: number;
  total: number;
  req: number;
  off: number;
  cats: Record<string, number>;
  samples: LItem[]; // up to 3 samples for popover
};

export async function readAgg(now=Date.now(), cat?:string, mode?:string){
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  let arr: LItem[] = [];
  try{ arr = JSON.parse(txt); }catch{ return []; }
  const filt = arr.filter(it => (now-it.ts) <= it.ttlSec*1000 && typeof it.qlat==='number' && typeof it.qlng==='number')
    .filter(it => !cat || it.cat===cat)
    .filter(it => !mode || it.mode===mode);
  const map = new Map<string, CellAgg>();
  for(const it of filt){
    const cell = cellFor(it.qlat!, it.qlng!);
    const a = map.get(cell.key) || { key: cell.key, glat:cell.glat, glng:cell.glng, total:0, req:0, off:0, cats:{}, samples:[] };
    a.total += 1;
    if(it.mode==='request') {a.req += 1;} else {a.off += 1;}
    a.cats[it.cat] = (a.cats[it.cat]||0)+1;
    if(a.samples.length<3) {a.samples.push(it);}
    map.set(cell.key, a);
  }
  return Array.from(map.values());
}



