import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
const FILE = '/tmp/track.jsonl';
let t:any=null;
export function startTrack(periodSec=20){
  if(t) {(globalThis as any).clearInterval(t);}
  t=(globalThis as any).setInterval(async()=>{
    try{
      const p = await Location.getLastKnownPositionAsync({}); 
      if(p){ const row = { ts: Date.now(), lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; 
        const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
        await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(row)+'\n'); }
    }catch{
      // Ignore errors
    }
  }, Math.max(5,periodSec)*1000);
}
export function stopTrack(){ if(t){ (globalThis as any).clearInterval(t); t=null; } }
export async function readTrack(limit=500){ 
  const ex=await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt=await FileSystem.readAsStringAsync(FILE);
  return txt.split('\n').filter(Boolean).slice(-limit).map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean);
}
