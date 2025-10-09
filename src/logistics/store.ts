import * as FileSystem from "expo-file-system";
import { LItem, LCategory, LMode } from "./types";

const DIR = "/tmp/";
const FILE = DIR + "logistics.json";

export async function listLogistics(cat?:LCategory, mode?:LMode, now=Date.now()){
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  try{
    const arr = JSON.parse(txt) as LItem[];
    return arr
      .filter(p=> (now-p.ts) <= p.ttlSec*1000)
      .filter(p=> !cat || p.cat===cat)
      .filter(p=> !mode || p.mode===mode)
      .sort((a,b)=>a.ts-b.ts)
      .slice(-400);
  }catch{ return []; }
}

export async function addLogistics(it: LItem){
  const ex = await FileSystem.getInfoAsync(FILE);
  const cur = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(FILE)) : [];
  cur.push(it);
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(cur));
}
