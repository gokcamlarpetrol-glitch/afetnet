import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { QueueMeta, QueueRecordV2, QueueKind } from "./v2.types";
import { quantizeLatLng } from "../geo/coarse";

const DIR = "/tmp/";
const WAL = DIR + "ocb.jsonl";          // append-only queue log
const WAL_TMP = DIR + "ocb.jsonl.tmp";   // temp for atomic appends
const LEGACY_JSON = DIR + "ocb.json";    // v1 array file (if exists)

function toJsonl(r: QueueRecordV2){ return JSON.stringify(r) + "\n"; }

async function sha256(txt: string){
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, txt);
}

function makeId(){
  // simple ULID-ish: ts + random; sufficient uniqueness offline
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${ts}${rnd}`;
}

export async function initQueue(): Promise<QueueMeta>{
  // Ensure file exists; if legacy exists, migrate once.
  const exists = (await FileSystem.getInfoAsync(WAL)).exists;
  if(!exists){
    // migrate legacy array file if present
    const legacy = await FileSystem.getInfoAsync(LEGACY_JSON);
    if(legacy.exists){
      try{
        const raw = await FileSystem.readAsStringAsync(LEGACY_JSON);
        const arr = JSON.parse(raw) as any[];
        // append legacy as v2 records
        for(const it of arr){
          await append(it.kind ?? "note", it.payload ?? it, true);
        }
        // keep legacy as historical artifact; do not delete silently
      }catch{}
    }else{
      await FileSystem.writeAsStringAsync(WAL, ""); // create empty
    }
  }
  return await stats();
}

export async function stats(): Promise<QueueMeta>{
  const info = await FileSystem.getInfoAsync(WAL);
  let count = 0, pending = 0, lastTs: number|undefined = undefined;
  if(info.exists){
    const content = await FileSystem.readAsStringAsync(WAL);
    const lines = content.split("\n").filter(Boolean);
    for(const ln of lines){
      try{
        const r = JSON.parse(ln) as QueueRecordV2;
        count++; if(!r.sent) {pending++;}
        if(!lastTs || r.ts > lastTs) {lastTs = r.ts;}
      }catch{ /* skip corrupt lines */ }
    }
  }
  return { file: WAL, count, pending, lastTs };
}

export async function list(limit=100, includeSent=false): Promise<QueueRecordV2[]>{
  const content = await FileSystem.readAsStringAsync(WAL).catch(()=> "");
  const lines = content.split("\n").filter(Boolean).slice(-limit); // tail
  const out: QueueRecordV2[] = [];
  for(const ln of lines){
    try{
      const r = JSON.parse(ln) as QueueRecordV2;
      if(includeSent || !r.sent) {out.push(r);}
    }catch{}
  }
  return out;
}

async function withCoarseGeo(payload:any){
  try{
    // You may have a getLastLocation() helper; if not available, keep payload untouched.
    const loc = await (globalThis as typeof globalThis).getLastLocation?.();
    if(loc && typeof loc.latitude==="number" && typeof loc.longitude==="number"){
      const q = quantizeLatLng(loc.latitude, loc.longitude);
      return { ...payload, qlat: q.lat, qlng: q.lng };
    }
  }catch{}
  return payload;
}

export async function append(kind: QueueKind, payload: any, fromLegacy=false): Promise<QueueRecordV2>{
  const id = makeId();
  const ts = Date.now();
  const enriched = await withCoarseGeo(payload ?? null);
  const payloadJson = JSON.stringify(enriched);
  const hash = await sha256(`${id}|${ts}|${kind}|${payloadJson}`);
  const rec: QueueRecordV2 = { id, ts, kind, payload: JSON.parse(payloadJson), ver: 2, hash };

  // atomic append: write tmp then concat+move
  const line = toJsonl(rec);
  const tmpHas = await FileSystem.getInfoAsync(WAL);
  const current = tmpHas.exists ? await FileSystem.readAsStringAsync(WAL) : "";
  await FileSystem.writeAsStringAsync(WAL_TMP, current + line, { encoding: "utf8" });
  await FileSystem.moveAsync({ from: WAL_TMP, to: WAL });
  return rec;
}

export async function markSent(ids: string[]): Promise<void>{
  if(ids.length === 0) {return;}
  const content = await FileSystem.readAsStringAsync(WAL).catch(()=> "");
  if(!content){ return; }
  const lines = content.split("\n").filter(Boolean);
  const updated: string[] = [];
  for(const ln of lines){
    try{
      const r = JSON.parse(ln) as QueueRecordV2;
      if(ids.includes(r.id)){ r.sent = true; }
      updated.push(JSON.stringify(r));
    }catch{
      // keep original line if parse fails
      updated.push(ln);
    }
  }
  const joined = updated.join("\n") + "\n";
  await FileSystem.writeAsStringAsync(WAL_TMP, joined, { encoding: "utf8" });
  await FileSystem.moveAsync({ from: WAL_TMP, to: WAL });
}

export async function verifyIntegrity(sample=100): Promise<{checked:number; bad:number}>{
  const items = await list(sample, true);
  let bad = 0;
  for(const r of items){
    const payloadJson = JSON.stringify(r.payload ?? null);
    const h = await sha256(`${r.id}|${r.ts}|${r.kind}|${payloadJson}`);
    if(h !== r.hash) {bad++;}
  }
  return { checked: items.length, bad };
}

// Simulated "drain": returns ids that would be sent; marks them sent if confirm=true
export async function drainSim(max=20, confirm=false): Promise<{ids:string[]; pending:number}>{
  const pendingList = (await list(1000,false)).slice(0, max);
  const ids = pendingList.map(r=>r.id);
  if(confirm && ids.length) {await markSent(ids);}
  const st = await stats();
  return { ids, pending: st.pending };
}
