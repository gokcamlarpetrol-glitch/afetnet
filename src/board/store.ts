import * as FileSystem from "expo-file-system";

const DIR = "/tmp/";
const FILE = DIR + "board.json";

export type BoardPost = {
  id: string; ts: number;
  kind: "sos"|"announcement"|"system";
  text: string; ttlSec: number;
  qlat?: number; qlng?: number;
  sig?: string; // optional (Phase 42)
};

export async function listBoard(now=Date.now()){
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  try{
    const arr = JSON.parse(txt) as BoardPost[];
    return arr.filter(p=> (now - p.ts) <= p.ttlSec*1000).sort((a,b)=>a.ts-b.ts).slice(-200);
  }catch{ return []; }
}

export async function addBoard(post: BoardPost){
  const ex = await FileSystem.getInfoAsync(FILE);
  const cur = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(FILE)) : [];
  cur.push(post);
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(cur));
}
