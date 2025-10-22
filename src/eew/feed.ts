import NetInfo from '@react-native-community/netinfo';
import { EEWAlert, EEWPush } from './types';
import { pushEEW, notifyEEW } from './store';

type Cfg = {
  WS_URLS: string[];     // e.g. ["wss://eew.afad.gov.tr/ws", "wss://eew.kandilli.org/ws"]
  POLL_URLS: string[];   // e.g. REST fallbacks
  POLL_INTERVAL_SEC: number;
};
let cfg: Cfg = {
  WS_URLS: [],
  POLL_URLS: [],
  POLL_INTERVAL_SEC: 60,
};

let ws: any = null;
let polling=false;
const seen = new Set<string>();

export function setEEWFeedConfig(c: Partial<Cfg>){ cfg = { ...cfg, ...c }; }

export async function startEEW(){
  const net = await NetInfo.fetch().catch(()=>null);
  if(!net?.isConnected) {return;}

  // Try WS first
  for(const url of cfg.WS_URLS){
    try{
      ws = new (globalThis as any).WebSocket(url);
      ws.onmessage = (ev)=>{
        try{
          const msg = JSON.parse(String(ev.data)) as EEWPush|EEWAlert;
          const a: EEWAlert = (msg as any).kind==='eew' ? (msg as any).alert : (msg as any);
          if(!a || !a.id) {return;}
          if(seen.has(a.id)) {return;} seen.add(a.id);
          pushEEW(a).then(()=>notifyEEW(a)).catch(()=>{
            // Ignore notification errors
          });
        }catch{
          // Ignore JSON parse errors
        }
      };
      ws.onerror = ()=>{
        // Ignore WebSocket errors
      };
      ws.onclose = ()=>{ ws=null; };
      break;
    }catch{ 
      ws=null; 
    }
  }
  // Fallback poll
  if(!polling){ polling=true; pollLoop(); }
}
export function stopEEW(){
  try{ ws?.close(); }catch{
    // Ignore close errors
  }
  ws=null; polling=false;
}

async function pollLoop(){
  while(polling){
    const net = await NetInfo.fetch().catch(()=>null);
    if(net?.isConnected){
      for(const url of cfg.POLL_URLS){
        try{
          const r = await fetch(url); const j = await r.json();
          const arr: EEWAlert[] = normalizeAny(j);
          for(const a of arr){
            if(!a || !a.id) {continue;} if(seen.has(a.id)) {continue;}
            seen.add(a.id); await pushEEW(a); await notifyEEW(a);
          }
        }catch{
          // Ignore fetch errors
        }
      }
    }
    await new Promise(r=>(globalThis as any).setTimeout(r, (cfg.POLL_INTERVAL_SEC||60)*1000));
  }
}

function normalizeAny(j:any): EEWAlert[]{
  // Try common fields and fallbacks
  const out: EEWAlert[] = [];
  const arr = Array.isArray(j)? j : (j?.features ? j.features : (j?.result||[]));
  for(const it of arr){
    try{
      const id = it.id || it.eventId || it.code || (it.time||it.ts||Date.now())+':'+(it.lat||it.latitude)+':'+(it.lng||it.longitude);
      const ts = it.ts || it.time || new Date(it.date || it.origin_time || Date.now()).getTime();
      const lat = parseFloat(it.lat ?? it.latitude);
      const lng = parseFloat(it.lng ?? it.longitude);
      const mag = parseFloat(it.mag ?? it.magnitude ?? it.Mw ?? it.Md ?? 0);
      const depth = parseFloat(it.depth ?? it.depth_km ?? 10);
      const src = (it.src || it.source || 'AFAD').toUpperCase();
      if([lat,lng,mag,ts].every(Number.isFinite)){
        out.push({ id:String(id), ts, lat, lng, depth, mag, src: (src.includes('KAND')?'KANDILLI': src.includes('USGS')?'USGS':'AFAD') as any });
      }
    }catch{
      // Ignore normalization errors
    }
  }
  return out;
}



