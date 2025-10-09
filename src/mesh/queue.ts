import * as FileSystem from "expo-file-system";
import { p2pLocalSend } from "../p2p/send";
import { getPower } from "../power/profile";
import { laneDelay, Lane } from "./priority";

type QItem = { id:string; payload:any; ts:number; tries:number; next:number; kind:"msg"|"ack"; lane?:Lane };

const OUT = "/tmp/mesh.out.jsonl";
const IN  = "/tmp/mesh.in.jsonl";

export async function enqueue(payload:any, kind:"msg"|"ack"="msg", lane:Lane="normal"){
  const it:QItem = { id: payload.id || ("q_"+Date.now().toString(36)), payload, ts: Date.now(), tries:0, next: Date.now()+laneDelay(lane), kind, lane };
  const existing = await FileSystem.readAsStringAsync(OUT).catch(()=>"");
  await FileSystem.writeAsStringAsync(OUT, existing + JSON.stringify(it)+"\n");
}
export async function readOut(limit=500): Promise<QItem[]>{
  const ex=await FileSystem.getInfoAsync(OUT); if(!ex.exists) {return [];}
  const txt=await FileSystem.readAsStringAsync(OUT);
  return txt.split("\n").filter(Boolean).slice(-limit).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);
}
async function rewriteOut(arr:QItem[]){ await FileSystem.writeAsStringAsync(OUT, arr.map(x=>JSON.stringify(x)).join("\n")); }

export async function pumpOnce(){
  const arr = await readOut(1000);
  const now = Date.now(); const p=getPower();
  const ttl = 24*60*60*1000; // 24h
  let changed=false;
  for(const it of arr){
    if(now - it.ts > ttl) { it.tries=999; changed=true; continue; }
    if(now < (it.next||0)) {continue;}
    await p2pLocalSend(it.payload).catch(()=>{});
    it.tries++;
    // backoff: 1m, 5m, 30m, 2h
    const steps=[60e3, 5*60e3, 30*60e3, 2*60*60e3];
    const idx=Math.min(it.tries-1, steps.length-1);
    it.next = now + Math.max(steps[idx], p.meshPingSec*1000);
    changed=true;
  }
  if(changed){
    const alive = arr.filter(x=> x.tries<999);
    await rewriteOut(alive);
  }
}
let on=false; let t:any=null;
export function startPump(){ if(on) {return;} on=true; t=setInterval(pumpOnce, 15_000); }
export function stopPump(){ on=false; if(t){ clearInterval(t); t=null; } }

// Inbox (optional for debugging)
export async function inboxWrite(msg:any){ 
  const existing = await FileSystem.readAsStringAsync(IN).catch(()=>"");
  await FileSystem.writeAsStringAsync(IN, existing + JSON.stringify({ts:Date.now(),msg})+"\n");
}
