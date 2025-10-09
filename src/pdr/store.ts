import * as FileSystem from "expo-file-system";
import { haversine } from "../geo/haversine";

const DIR = "/tmp/";
const FILE = DIR + "pdr.trail.jsonl";

export type TrailPoint = { ts:number; lat:number; lng:number; src:"gps"|"pdr" };

export async function appendTrail(p: TrailPoint){
  const ex = await FileSystem.getInfoAsync(FILE);
  const existing = ex.exists ? await FileSystem.readAsStringAsync(FILE) : "";
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(p)+"\n");
}
export async function readTrail(limit=500): Promise<TrailPoint[]>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  const lines = txt.split("\n").filter(Boolean).slice(-limit);
  return lines.map(l=>JSON.parse(l));
}
export async function clearTrail(){ const ex = await FileSystem.getInfoAsync(FILE); if(ex.exists) {await FileSystem.deleteAsync(FILE, { idempotent:true });} }
