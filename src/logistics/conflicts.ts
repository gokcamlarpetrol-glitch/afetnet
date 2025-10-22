import * as FileSystem from 'expo-file-system';
import { similar } from '../util/similarity';
import { LItem } from './types';
import { cellFor } from '../geo/grid';

const DIR = '/tmp/';
const FILE = DIR + 'logistics.json';
const CONFLICTS = DIR + 'logistics.conflicts.json';

export type Conflict = {
  id: string;
  key: string;   // cell key
  ts: number;
  count: number;
  cat: string;
  sampleIds: string[];
};

export async function detectConflicts(windowMs = 2*3600*1000, simThresh = 0.5): Promise<Conflict[]>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  let arr: LItem[] = [];
  try{ arr = JSON.parse(txt); }catch{ return []; }
  const now = Date.now();
  const recent = arr.filter(it => (now-it.ts)<=windowMs && it.mode==='request' && typeof it.qlat==='number' && typeof it.qlng==='number');
  const byCell = new Map<string, LItem[]>();
  for(const it of recent){
    const { key } = cellFor(it.qlat!, it.qlng!);
    const list = byCell.get(key) || [];
    list.push(it); byCell.set(key, list);
  }
  const out: Conflict[] = [];
  for(const [key, list] of byCell){
    // pairwise cluster by category & similarity
    const used = new Set<string>();
    for(let i=0;i<list.length;i++){
      if(used.has(list[i].id)) {continue;}
      const group = [list[i]];
      for(let j=i+1;j<list.length;j++){
        if(list[i].cat!==list[j].cat) {continue;}
        if(similar(list[i].text, list[j].text) >= simThresh){ group.push(list[j]); used.add(list[j].id); }
      }
      if(group.length>=3){
        out.push({ id: `conf_${key}_${group[0].cat}_${group[0].ts}`, key, ts: now, count: group.length, cat: group[0].cat, sampleIds: group.map(g=>g.id).slice(0,5) });
      }
    }
  }
  // persist
  await FileSystem.writeAsStringAsync(CONFLICTS, JSON.stringify(out));
  return out;
}

export async function listConflicts(){
  const ex = await FileSystem.getInfoAsync(CONFLICTS);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(CONFLICTS)); }catch{ return []; }
}



