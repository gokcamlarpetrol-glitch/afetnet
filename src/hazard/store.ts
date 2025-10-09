import * as FileSystem from "expo-file-system";
import { HazardZone } from "./types";

const DIR = "/tmp/";
const FILE = DIR + "hazards.json";

export async function listHazards(): Promise<HazardZone[]>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ return []; }
}
async function save(list: HazardZone[]){ await FileSystem.writeAsStringAsync(FILE, JSON.stringify(list)); }
export async function upsertHazard(z: HazardZone){
  const list = await listHazards();
  const i = list.findIndex(x=>x.id===z.id);
  if(i<0) {list.push(z);} else {list[i]=z;}
  await save(list); return z;
}
export async function removeHazard(id: string){
  const list = await listHazards();
  await save(list.filter(x=>x.id!==id));
}



