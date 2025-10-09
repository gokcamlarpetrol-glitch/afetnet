/**
 * Coarse/quantized lat/lng to protect privacy and reduce data size.
 * Quantize by ~200m steps. 1 deg ~ 111km → 0.002 deg ~ 222m.
 */
export const Q = 0.002; // ~222m
export function quantizeLatLng(lat: number, lng: number){
  const q = (v:number)=> Math.round(v / Q) * Q;
  return { lat: q(lat), lng: q(lng) };
}

/** Age bucket helper for fading UI */
export function ageBucket(ts: number): "fresh"|"stale"|"old"|"expired"{
  const ageH = (Date.now()-ts)/3600000;
  if(ageH <= 24) {return "fresh";}
  if(ageH <= 72) {return "stale";}
  if(ageH <= 120) {return "old";}
  return "expired";
}



