import * as FileSystem from "expo-file-system";
import { DrawShape } from "./types";
const FILE = "/tmp/drawings.jsonl";

export async function addOrUpdateShape(s: DrawShape){
  const arr = await listShapes(800);
  const i = arr.findIndex(x=>x.id===s.id);
  const out = i>=0 ? arr.map(x=> x.id===s.id? s: x) : [...arr, s];
  await FileSystem.writeAsStringAsync(FILE, out.map(x=>JSON.stringify(x)).join("\n"));
}
export async function listShapes(limit=800): Promise<DrawShape[]>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  const now = Date.now();
  return txt.split("\n").filter(Boolean).slice(-limit).map(l=>{ try{return JSON.parse(l);}catch{return null;} })
    .filter(Boolean).filter((x:DrawShape)=> !x.ttlSec || (x.ts + x.ttlSec*1000)>now) as DrawShape[];
}

export async function deleteShape(id:string){
  const arr = await listShapes(800);
  const out = arr.filter(x=> x.id!==id);
  await FileSystem.writeAsStringAsync(FILE, out.map(x=>JSON.stringify(x)).join("\n"));
}
