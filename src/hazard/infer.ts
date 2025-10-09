import * as FileSystem from "expo-file-system";
import { cellFor } from "../geo/grid";
import { HazardZone } from "./types";
import { haversine } from "../geo/haversine";

const DIR = "/tmp/";
const MSG = DIR + "msg.inbox.jsonl";
const LOG = DIR + "logistics.json";
const DRAFT = DIR + "hazards.draft.json";

type Draft = HazardZone & { draft: true };

export async function inferHazards(windowMs=90*60*1000): Promise<Draft[]>{
  const now = Date.now();
  // collect SOS
  const sos: {lat:number;lng:number;ts:number}[] = [];
  const ex = await FileSystem.getInfoAsync(MSG);
  if(ex.exists){
    const body = await FileSystem.readAsStringAsync(MSG);
    const lines = body.split("\n").filter(Boolean).slice(-3000);
    for(const ln of lines){
      try{
        const m = JSON.parse(ln);
        if(m.kind==="sos" && typeof m.qlat==="number" && typeof m.qlng==="number" && (now-m.ts)<=windowMs){
          sos.push({ lat:m.qlat, lng:m.qlng, ts:m.ts });
        }
      }catch{}
    }
  }
  // collect logistics (shelter/medicine requests)
  const reqs: {lat:number;lng:number;ts:number;cat:string}[] = [];
  const ex2 = await FileSystem.getInfoAsync(LOG);
  if(ex2.exists){
    try{
      const arr = JSON.parse(await FileSystem.readAsStringAsync(LOG));
      for(const it of arr){
        if((now-it.ts)<=windowMs && it.mode==="request" && typeof it.qlat==="number" && typeof it.qlng==="number" && (it.cat==="shelter" || it.cat==="medicine")){
          reqs.push({ lat:it.qlat, lng:it.qlng, ts:it.ts, cat: it.cat });
        }
      }
    }catch{}
  }
  // aggregate by cell
  const map = new Map<string, {lat:number;lng:number; count:number; kind:"sos"|"req";}>();
  const bump = (p:{lat:number;lng:number}, kind:"sos"|"req")=>{
    const c = cellFor(p.lat,p.lng); const k=c.key;
    const cur = map.get(k) || { lat:c.glat, lng:c.glng, count:0, kind };
    cur.count++; map.set(k, cur);
  };
  sos.forEach(p=>bump(p,"sos"));
  reqs.forEach(p=>bump(p,"req"));
  const out: Draft[] = [];
  for(const [key,v] of map){
    if(v.count>=3){
      const sev = v.count>=8 ? 3 : v.count>=5 ? 2 : 1;
      const t = v.kind==="sos" ? "collapse" : "aftershock";
      out.push({
        id: "hz_draft_"+key.replace(",","_"),
        t: t as any, severity: sev as any,
        center: { lat:v.lat, lng:v.lng },
        radius: 120 + Math.min(130, v.count*10),
        ts: now, note: "infered:"+v.kind, draft: true
      } as Draft);
    }
  }
  await FileSystem.writeAsStringAsync(DRAFT, JSON.stringify(out));
  return out;
}

export async function listDrafts(): Promise<Draft[]>{
  const ex = await FileSystem.getInfoAsync(DRAFT);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(DRAFT)); }catch{ return []; }
}



