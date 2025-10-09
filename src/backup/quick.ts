import * as FileSystem from "expo-file-system";
import QRCode from "react-native-qrcode-svg";
import { secretboxEncrypt, secretboxDecrypt } from "../crypto/backup";

const DIR = "/tmp/";
const FILES = [
  "afn:e2ee/identity", // conceptual — below we actually read concrete app files
];

type Chunk = { v:1; i:number; n:number; data:string };

function chunk(str:string, size=600){ const out:string[]=[]; for(let i=0;i<str.length;i+=size){ out.push(str.slice(i,i+size)); } return out; }

export async function buildQuickBackup(password:string){
  // Assemble minimal state: identity keys, role, teams, approvals, settings
  const picks = [
    "e2ee.sessions.json", "teams.json", "approvals.json", "mesh.health.json",
    "route.graph.json", "hazards.json", "logistics.json", "board.json"
  ];
  const obj: Record<string, any> = {};
  for(const p of picks){
    try{
      const path = DIR + p;
      const ex = await FileSystem.getInfoAsync(path);
      if(ex.exists){ obj[p] = await FileSystem.readAsStringAsync(path); }
    }catch{}
  }
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  const enc = await secretboxEncrypt(raw, password);
  const payload = JSON.stringify(enc);
  const parts = chunk(Buffer.from(payload).toString("base64"), 800);
  return parts.map<Chunk>((data,i)=>({ v:1, i, n:parts.length, data }));
}

export async function restoreQuickBackup(chunks: Chunk[], password: string){
  if(chunks.length===0) {throw new Error("Boş yedek");}
  const ordered = chunks.sort((a,b)=>a.i-b.i);
  const b64 = ordered.map(c=>c.data).join("");
  const json = Buffer.from(b64, "base64").toString();
  const dec = await secretboxDecrypt(JSON.parse(json), password);
  const obj = JSON.parse(new TextDecoder().decode(dec));
  for(const [name, content] of Object.entries(obj)){
    await FileSystem.writeAsStringAsync(DIR+name, String(content));
  }
}



