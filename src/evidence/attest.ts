import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { attestFolder } from "./paths";
import { getPublicKeyB64, sign as edSign, verify as edVerify } from "../crypto/keys";

export type Attest = {
  v: 1;
  packId: string;
  packSha: string;        // manifest sha256 hex
  signerPubB64: string;
  sigB64: string;         // signature over sha256(packId|packSha|ts)
  ts: number;
};

export async function ensureFolder(packId:string){
  const path = attestFolder(packId);
  const ex = await FileSystem.getInfoAsync(path);
  if(!ex.exists) {await FileSystem.makeDirectoryAsync(path, { intermediates: true });}
  return path;
}

export async function makeAttest(packId:string, packSha:string): Promise<Attest>{
  const pub = await getPublicKeyB64();
  const payload = `${packId}|${packSha}|${Date.now()}`;
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  const sigB64 = await edSign(h);
  return { v:1, packId, packSha, signerPubB64: pub, sigB64, ts: Date.now() };
}

export async function saveAttest(a:Attest){
  const folder = await ensureFolder(a.packId);
  const short = a.signerPubB64.slice(0,16).replace(/[+/=]/g,"_");
  await FileSystem.writeAsStringAsync(folder + short + ".json", JSON.stringify(a, null, 2));
}

export async function loadAttests(packId:string): Promise<Attest[]>{
  const folder = attestFolder(packId);
  const ex = await FileSystem.getInfoAsync(folder);
  if(!ex.exists) {return [];}
  const list = await FileSystem.readDirectoryAsync(folder);
  const out:Attest[]=[];
  for(const f of list){
    try{
      const txt = await FileSystem.readAsStringAsync(folder+f);
      const a = JSON.parse(txt);
      out.push(a);
    }catch{}
  }
  return out;
}

export async function verifyAttest(a:Attest): Promise<boolean>{
  try{
    // reconstruct original hash base
    const payload = `${a.packId}|${a.packSha}|${a.ts}`;
    const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
    return edVerify(a.signerPubB64, h, a.sigB64);
  }catch{ return false; }
}



