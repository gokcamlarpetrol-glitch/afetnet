import * as FileSystem from "expo-file-system";
import { Bulletin } from "./types";

const FILE = "/tmp/bulletins.jsonl";

export async function addBulletin(b: Bulletin){
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>"");
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(b)+"\n");
}
export async function listBulletins(limit=300): Promise<Bulletin[]>{
  const ex=await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt=await FileSystem.readAsStringAsync(FILE);
  const arr = txt.split("\n").filter(Boolean).slice(-limit).map(l=>{try{return JSON.parse(l);}catch{return null;} }).filter(Boolean) as Bulletin[];
  const now = Date.now();
  return arr.filter(b=> !b.expires || b.expires>now);
}



