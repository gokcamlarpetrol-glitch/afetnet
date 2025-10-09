import NetInfo from "@react-native-community/netinfo";
import { appendQuake, notifyQuake, Quake } from "./store";

// Endpoint'ler Ayarlar'dan değiştirilebilir.
let cfg = {
  AFAD_URL: "https://deprem.afad.gov.tr/apiv2/event/latest",   // örnek JSON (uyarlamalı parse)
  KANDILLI_URL: "https://api.ornek.kandilli/last",              // yer tutucu; Ayarlar'dan güncellenebilir
  USGS_URL: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
};

export function setQuakeUrls(u: Partial<typeof cfg>){ cfg = { ...cfg, ...u }; }

async function hasInternet(){ try{ const s=await NetInfo.fetch(); return !!s.isConnected; }catch{ return false; } }

export async function pollQuakes(){
  if(!(await hasInternet())) {return;}
  // Her kaynak için getir → normalize → new olanları kaydet + bildir
  await Promise.all([pullUSGS(), pullAFAD(), pullKandilli()]);
}

const seenIds = new Set<string>();
function once(id:string){ if(seenIds.has(id)) {return false;} seenIds.add(id); return true; }

async function pullUSGS(){
  try{
    const r = await fetch(cfg.USGS_URL); const j = await r.json();
    const feats = j.features || [];
    for(const f of feats){
      const id = "USGS_"+f.id;
      if(!once(id)) {continue;}
      const [lng,lat,depth] = f.geometry.coordinates;
      const mag = f.properties.mag || 0;
      const ts = f.properties.time || Date.now();
      const q: Quake = { id, ts, lat, lng, depth, mag, src:"USGS" };
      await appendQuake(q); await notifyQuake(q);
    }
  }catch{}
}

async function pullAFAD(){
  try{
    const r = await fetch(cfg.AFAD_URL); const j = await r.json();
    // Beklenen alanlar: latitude, longitude, magnitude, date
    const items = Array.isArray(j) ? j : (j?.result || []);
    for(const it of items){
      const id = "AFAD_"+(it.eventId || it.id || (it.date || "")+":"+it.latitude+":"+it.longitude);
      if(!once(id)) {continue;}
      const lat = parseFloat(it.latitude||it.lat), lng = parseFloat(it.longitude||it.lng);
      const mag = parseFloat(it.magnitude||it.mag||it.Md||it.Mw||0);
      const ts = new Date(it.date || it.time || Date.now()).getTime();
      if(!isFinite(lat)||!isFinite(lng)||!isFinite(mag)||!isFinite(ts)) {continue;}
      const q: Quake = { id, ts, lat, lng, mag, src:"AFAD" };
      await appendQuake(q); await notifyQuake(q);
    }
  }catch{}
}

async function pullKandilli(){
  try{
    const r = await fetch(cfg.KANDILLI_URL); const txt = await r.text();
    // Basit CSV/TSV/HTML temizlemesi — sayıları yakala (uyarlamalı)
    const lines = txt.split("\n").slice(0,50);
    for(const ln of lines){
      const m = ln.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}[^,;\s]*)[,\s;]+([\d\.\-]+)[,\s;]+([\d\.\-]+)[,\s;]+M[:\s]?([\d\.]+)/i);
      if(!m) {continue;}
      const ts = new Date(m[1]).getTime(); const lat=parseFloat(m[2]); const lng=parseFloat(m[3]); const mag=parseFloat(m[4]);
      const id = "KAND_"+m[1]+"_"+lat+"_"+lng;
      if(!once(id)) {continue;}
      const q: Quake = { id, ts, lat, lng, mag, src:"KANDILLI" };
      await appendQuake(q); await notifyQuake(q);
    }
  }catch{}
}
