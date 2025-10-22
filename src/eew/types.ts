export type EEWAlert = {
  id: string;           // stable ID for dedup
  ts: number;           // origin time (ms)
  lat: number;
  lng: number;
  depth?: number;       // km
  mag: number;          // Mw or local equivalent
  src: 'AFAD'|'KANDILLI'|'USGS'|'SIM'|'LOCAL_PWAVE';
};

export type EEWPush = {
  kind: 'eew';
  alert: EEWAlert;
};

export type EtaResult = {
  distKm: number;
  etaSec: number;       // estimated arrival of strong S-waves
  pEtaSec: number;      // P-wave arrival
  mmi: number;          // predicted intensity (MMI 1..10)
  label: 'Severe'|'Strong'|'Light'|'Weak';
};

export function haversineKm(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  const R=6371, toR=(x:number)=>x*Math.PI/180;
  const dLat=toR(b.lat-a.lat), dLng=toR(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}



