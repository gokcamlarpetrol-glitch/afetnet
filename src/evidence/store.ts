import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { sign, getPublicKeyB64 } from "../crypto/keys";
import * as Timechain from "../timechain/store";
import { EvidenceItem, EvidencePack } from "./types";

const DIR = "/tmp/";
export const EV_DIR = DIR + "evidence/";
const INDEX = EV_DIR + "index.json";

async function ensureDir(){
  const ex = await FileSystem.getInfoAsync(EV_DIR);
  if(!ex.exists) {await FileSystem.makeDirectoryAsync(EV_DIR, { intermediates: true });}
}

export async function loadIndex(): Promise<EvidencePack[]>{
  await ensureDir();
  const info = await FileSystem.getInfoAsync(INDEX);
  if(!info.exists) {return [];}
  try{
    const txt = await FileSystem.readAsStringAsync(INDEX);
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}

async function saveIndex(list: EvidencePack[]){
  await FileSystem.writeAsStringAsync(INDEX, JSON.stringify(list, null, 2));
}

function makeId(){
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2,10);
  return `ev_${ts}_${rnd}`;
}

export async function createPack(qlat?:number, qlng?:number){
  await ensureDir();
  const pack: EvidencePack = { id: makeId(), ts: Date.now(), items: [], qlat, qlng };
  const list = await loadIndex();
  list.push(pack); await saveIndex(list);
  return pack;
}

export async function addItem(packId: string, item: EvidenceItem){
  const list = await loadIndex();
  const i = list.findIndex(p=>p.id===packId);
  if(i<0) {throw new Error("Pack not found");}
  list[i].items.push(item);
  await saveIndex(list);
  return list[i];
}

export async function finalizePack(packId: string){
  const list = await loadIndex();
  const i = list.findIndex(p=>p.id===packId);
  if(i<0) {throw new Error("Pack not found");}
  const manifest = JSON.stringify(list[i], null, 2);
  const sha = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, manifest);
  list[i].sha256 = sha;
  await saveIndex(list);
  // write manifest alongside assets
  await FileSystem.writeAsStringAsync(EV_DIR + `${packId}_manifest.json`, manifest);
  // sign manifest hash (detached)
  const sigB64 = await sign(sha);
  const pubB64 = await getPublicKeyB64();
  const sigDoc = { v:1, packId, ts: Date.now(), pubKeyB64: pubB64, sha256: sha, sigB64: sigB64 };
  await FileSystem.writeAsStringAsync(EV_DIR + `${packId}_signature.json`, JSON.stringify(sigDoc, null, 2));
  // timechain append
  await Timechain.append({ v:1, ts: Date.now(), type: "evidence", ref: packId, hash: sha });
  return list[i];
}

export async function listPacks(){ return loadIndex(); }
