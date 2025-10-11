import * as FileSystem from "expo-file-system";
import { Facility } from "./types";
import { p2pLocalSend } from "../p2p/send";

const FILE = "/tmp/fac.occ.json";
let mem: Record<string,{occ:number; ts:number}> = {};

export async function loadOcc(){ try{ mem = JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ mem={}; }
  (global as typeof globalThis).__AFN_OCC_CACHE__ = Object.fromEntries(Object.entries(mem).map(([k,v])=>[k,(v as any).occ])); return mem;
}
export async function saveOcc(){ await FileSystem.writeAsStringAsync(FILE, JSON.stringify(mem)); }

export async function setOccupancy(id:string, value:number){
  await loadOcc(); mem[id] = { occ: Math.max(0, Math.min(1,value)), ts: Date.now() }; await saveOcc();
  await p2pLocalSend({ kind:"fac_occ", v:1, id, value: mem[id].occ, ts: mem[id].ts });
}
export async function getOcc(id:string){ await loadOcc(); return mem[id]?.occ ?? 0; }

export async function handleIncoming(msg:any){
  if(msg.kind==="fac_occ" && msg.id!=null && msg.value!=null){
    await loadOcc(); const cur=mem[msg.id]; if(!cur || (msg.ts||0) > (cur.ts||0)){ mem[msg.id]={ occ:Number(msg.value), ts:Number(msg.ts)||Date.now() }; await saveOcc(); }
  }
}
