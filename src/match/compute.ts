import * as FileSystem from 'expo-file-system';
import { haversine } from '../geo/haversine';
import { cellFor } from '../geo/grid';
import { listHazards } from '../hazard/store';
import { hungarian } from './hungarian';

const DIR = '/tmp/';
const MSG = DIR + 'msg.inbox.jsonl';
const PEERS = DIR + 'peers.volunteers.json';

type POS = { id:string; lat:number; lng:number };

export async function readSOS(): Promise<POS[]>{
  const ex = await FileSystem.getInfoAsync(MSG);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(MSG);
  const lines = txt.split('\n').filter(Boolean).slice(-3000);
  const out: POS[] = [];
  for(const ln of lines){
    try{
      const m = JSON.parse(ln);
      if(m.kind==='sos' && typeof m.qlat==='number' && typeof m.qlng==='number'){
        out.push({ id: m.id||('sos_'+m.ts), lat: m.qlat, lng: m.qlng });
      }
    }catch{
      // Ignore JSON parse errors
    }
  }
  // unique by id (last wins)
  const map = new Map(out.map(o=>[o.id,o]));
  return Array.from(map.values());
}

export async function readVolunteers(): Promise<POS[]>{
  const ex = await FileSystem.getInfoAsync(PEERS);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(PEERS)); }catch{ return []; }
}

function hazardPenaltyAt(lat:number, lng:number, hz:any[]): number{
  const c = cellFor(lat,lng);
  for(const z of hz){
    // rough: if center within radius*1.2
    const d = Math.sqrt((z.center.lat-c.glat)**2 + (z.center.lng-c.glng)**2);
    if(d <= 0.01){ // ~1km grid-ish roughness
      return z.severity===1?0.25 : z.severity===2?0.5 : 1.0;
    }
  }
  return 0;
}

export async function computeMatching(){
  const [S, V, hz] = await Promise.all([readSOS(), readVolunteers(), listHazards()]);
  const cost: number[][] = S.map(s=> V.map(v=>{
    const d = haversine({ lat:v.lat,lng:v.lng },{ lat:s.lat,lng:s.lng });
    const pen = hazardPenaltyAt(s.lat,s.lng,hz);
    return d*(1+pen);
  }));
  const asg = hungarian(cost);
  const pairs = asg.map((a,i)=> ({ volunteer: V[a.col], sos: S[i], dist: cost[i][a.col] }));
  return { volunteers: V, sos: S, pairs };
}



