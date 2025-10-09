import * as FileSystem from "expo-file-system";
const FILE = "/tmp/selfcheck.jsonl";
export type SelfCheck = { id:string; ts:number; avpu:"A"|"V"|"P"|"U"; bleed:boolean; breathDiff:boolean; severePain:boolean; immobile:boolean; note?:string };

export async function addSelf(c: SelfCheck){
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>"");
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(c)+"\n");
}
export async function listSelf(limit=50){
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  return txt.split("\n").filter(Boolean).slice(-limit).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean) as SelfCheck[];
}
