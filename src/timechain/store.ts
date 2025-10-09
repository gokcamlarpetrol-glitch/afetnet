import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";

const DIR = "/tmp/";
const CHAIN = DIR + "timechain.jsonl";

export type ChainRecord = {
  v: 1;
  ts: number;                    // ms
  type: "evidence"|"status"|"sos"|"sys";
  ref: string;                   // e.g., packId or queue id
  hash: string;                  // payload hash (hex)
  prev?: string;                 // prev line hash (hex)
};

async function sha256(txt:string){
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, txt);
}

export async function headHash(): Promise<string|undefined>{
  const info = await FileSystem.getInfoAsync(CHAIN);
  if(!info.exists) {return undefined;}
  const body = await FileSystem.readAsStringAsync(CHAIN);
  const lines = body.trim().split("\n").filter(Boolean);
  if(!lines.length) {return undefined;}
  const last = lines[lines.length-1];
  return sha256(last);
}

export async function append(rec: ChainRecord){
  const prev = await headHash();
  const r = { ...rec, prev };
  const line = JSON.stringify(r);
  const info = await FileSystem.getInfoAsync(CHAIN);
  const cur = info.exists ? await FileSystem.readAsStringAsync(CHAIN) : "";
  await FileSystem.writeAsStringAsync(CHAIN+".tmp", (cur ? cur+"\n" : "") + line);
  await FileSystem.moveAsync({ from: CHAIN+".tmp", to: CHAIN });
}

export async function verifyChain(max=1000): Promise<{ ok:boolean; badAt?: number }>{
  const info = await FileSystem.getInfoAsync(CHAIN);
  if(!info.exists) {return { ok:true };}
  const body = await FileSystem.readAsStringAsync(CHAIN);
  const lines = body.trim().split("\n").filter(Boolean);
  let prevHash: string|undefined = undefined;
  for(let i=0;i<lines.length && i<max;i++){
    const ln = lines[i];
    const obj = JSON.parse(ln);
    if(obj.prev !== prevHash) {return { ok:false, badAt:i };}
    prevHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, ln);
  }
  return { ok:true };
}



