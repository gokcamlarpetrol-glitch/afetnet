import * as FileSystem from "expo-file-system";
import { RoadGraph, RoadNode, RoadEdge, Closure } from "./types";

const GFILE = "/tmp/roads.graph.json";
const CFILE = "/tmp/roads.closures.jsonl";

let gmem: RoadGraph | null = null;

export async function loadGraph(): Promise<RoadGraph|null>{
  if(gmem) {return gmem;}
  const ex = await FileSystem.getInfoAsync(GFILE);
  if(!ex.exists) {return null;}
  try{
    const j = JSON.parse(await FileSystem.readAsStringAsync(GFILE)) as RoadGraph;
    // build adjacency
    const out: Record<string,string[]> = {};
    for(const e of Object.values(j.edges)){
      (out[e.a] ||= []).push(e.id);
      if(!e.oneway) {(out[e.b] ||= []).push(e.id);}
    }
    j.out = out;
    gmem = j; return j;
  }catch{ return null; }
}

export async function saveGraph(j: RoadGraph){
  // (re)build adjacency
  const out: Record<string,string[]> = {};
  for(const e of Object.values(j.edges)){
    (out[e.a] ||= []).push(e.id);
    if(!e.oneway) {(out[e.b] ||= []).push(e.id);}
  }
  j.out = out; gmem=j;
  await FileSystem.writeAsStringAsync(GFILE, JSON.stringify(j));
}

export async function addClosure(c: Closure){
  const existing = await FileSystem.readAsStringAsync(CFILE).catch(()=>"");
  await FileSystem.writeAsStringAsync(CFILE, existing + JSON.stringify(c)+"\n");
}
export async function listClosures(limit=500): Promise<Closure[]>{
  const ex = await FileSystem.getInfoAsync(CFILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(CFILE);
  const now = Date.now();
  return txt.split("\n").filter(Boolean).slice(-limit).map(l=>{ try{return JSON.parse(l);}catch{return null;} })
    .filter(Boolean)
    .filter((c:Closure)=> !c.ttlSec || (c.ts + c.ttlSec*1000) > now) as Closure[];
}
export async function isClosed(edgeId:string){ const arr = await listClosures(500); return arr.some(c=>c.edgeId===edgeId); }



