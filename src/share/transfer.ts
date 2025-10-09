import * as FileSystem from "expo-file-system";
import { p2pLocalSend } from "../p2p/send";
import { getPower } from "../power/profile";
import { PackManifest } from "./types";
import { Bitfield, emptyBitfield, setHave, missing, percent } from "./proto";

export type RxState = {
  id: string; man: PackManifest; targetPath: string;
  bit: Bitfield; // pieces we have
  started: number; updated: number;
  done: boolean; tries: number; bytes: number;
};
const RXFILE = "/tmp/pack.rx.json";

let rxStates: Record<string,RxState> = {};

// persist/load
async function save(){ await FileSystem.writeAsStringAsync(RXFILE, JSON.stringify(rxStates)); }
export async function load(){ try{ rxStates = JSON.parse(await FileSystem.readAsStringAsync(RXFILE)); }catch{ rxStates={}; } return rxStates; }

export async function requestStart(id:string, man:PackManifest, targetPath:string){
  await load();
  if(!rxStates[id]) {rxStates[id] = { id, man, targetPath, bit: emptyBitfield(man.chunks), started: Date.now(), updated: Date.now(), done:false, tries:0, bytes:0 };}
  await save();
  await requestMissing(id);
}

export async function handleChunk(id:string, idx:number, b64:string){
  await load();
  const st = rxStates[id]; if(!st || st.done) {return;}
  const chunkPath = st.targetPath+".part"; // temp
  // append in order-agnostic; maintain a folder would be better, but we keep simple by prealloc omission
  const existing = await FileSystem.readAsStringAsync(chunkPath, { encoding: "base64" }).catch(()=>"");
  await FileSystem.writeAsStringAsync(chunkPath, existing + b64, { encoding: "base64" });
  setHave(st.bit, idx);
  st.updated = Date.now(); st.bytes += (b64.length*3/4)|0; // rough
  await save();

  if(missing(st.bit).length===0){
    // finalize
    await FileSystem.moveAsync({ from: chunkPath, to: st.targetPath }).catch(async()=>{ /* overwrite */ await FileSystem.deleteAsync(st.targetPath,{idempotent:true}); await FileSystem.moveAsync({from:chunkPath,to:st.targetPath}); });
    st.done = true; await save();
  }
}

export async function requestMissing(id:string){
  await load();
  const st = rxStates[id]; if(!st || st.done) {return;}
  const miss = missing(st.bit);
  await p2pLocalSend({ kind:"pack_req", v:1, id, need: miss, ts: Date.now() });
  st.tries++; await save();
}

export function getRxStates(){ return rxStates; }

// sender-side throttle
export async function senderThrottle(){ const p=getPower(); const pause = Math.max(150, Math.min(1200, Math.round(p.meshPingSec*25))); await new Promise(r=>setTimeout(r, pause)); }



