import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import { EEWAlert, EEWPush } from './types';
import { pushEEW, notifyEEW } from './store';

type Cfg = {
  WS_URLS: string[];     // e.g. ["wss://eew.afad.gov.tr/ws", "wss://eew.kandilli.org/ws"]
  POLL_URLS: string[];   // e.g. REST fallbacks
  POLL_INTERVAL_SEC: number;
  // Country-based WS selection
  EEW_WS_TR_PRIMARY?: string;    // TR resmi/öncelik WS
  EEW_WS_TR_FALLBACK?: string;   // TR fallback WS
  EEW_WS_GLOBAL_PRIMARY?: string; // Global primary (USGS/JMA)
  EEW_WS_GLOBAL_FALLBACK?: string; // Global fallback
  EEW_PROXY_WS?: string;          // Server relay WS
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

/**
 * Detect user's country/region for WS selection
 */
async function detectRegion(): Promise<'TR' | 'GLOBAL'> {
  try {
    // Try location-based detection first
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      // Simple check: Turkey bounding box approx
      if (loc.coords.latitude >= 36 && loc.coords.latitude <= 42 &&
          loc.coords.longitude >= 26 && loc.coords.longitude <= 45) {
        return 'TR';
      }
    }
    // Fallback: Check device locale
    const locale = Localization.getLocales()?.[0]?.languageCode || '';
    if (locale.toLowerCase().includes('tr')) {
      return 'TR';
    }
    return 'GLOBAL';
  } catch {
    // Default to GLOBAL if detection fails
    return 'GLOBAL';
  }
}

export async function startEEW(){
  const net = await NetInfo.fetch().catch(()=>null);
  if(!net?.isConnected) {return;}

  // Auto-select WS URLs based on region
  const region = await detectRegion();
  const wsUrls: string[] = [...cfg.WS_URLS]; // Start with manual config
  
  if (region === 'TR') {
    // TR priority: official WS > proxy > fallback > manual
    if (cfg.EEW_WS_TR_PRIMARY) wsUrls.unshift(cfg.EEW_WS_TR_PRIMARY);
    if (cfg.EEW_PROXY_WS) wsUrls.push(cfg.EEW_PROXY_WS);
    if (cfg.EEW_WS_TR_FALLBACK) wsUrls.push(cfg.EEW_WS_TR_FALLBACK);
  } else {
    // Global priority: global WS > proxy > manual
    if (cfg.EEW_WS_GLOBAL_PRIMARY) wsUrls.unshift(cfg.EEW_WS_GLOBAL_PRIMARY);
    if (cfg.EEW_PROXY_WS) wsUrls.push(cfg.EEW_PROXY_WS);
    if (cfg.EEW_WS_GLOBAL_FALLBACK) wsUrls.push(cfg.EEW_WS_GLOBAL_FALLBACK);
  }

  // Try WS first (with deduplication)
  const uniqueWsUrls = [...new Set(wsUrls.filter(Boolean))];
  for(const url of uniqueWsUrls){
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



