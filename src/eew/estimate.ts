import { EtaResult, haversineKm } from './types';

/** Simple ETA & intensity estimate (heuristic; not official GMPE) */
export function estimateETAAndMMI(epi:{lat:number;lng:number;depthKm?:number}, me:{lat:number;lng:number}, mag:number): EtaResult {
  const distKm = Math.max(1e-3, Math.sqrt(haversineKm(epi, me)**2 + (epi.depthKm||10)**2));
  // Wave speeds (rough): P~6.0 km/s, S~3.5 km/s
  const pEtaSec = distKm/6.0;
  const etaSec = distKm/3.5;

  // Heuristic intensity (MMI proxy) using simple attenuation:
  // PGA ~ 10^(a + b*M - c*log10(R)) → map to MMI. Use rough a=-1.5, b=0.5, c=1.3
  const a=-1.5, b=0.5, c=1.3;
  const pgaLog10 = a + b*mag - c*Math.log10(distKm);
  // Map to MMI (very rough): MMI ≈ 3 + 2.5*(pgaLog10) clipped
  let mmi = 3 + 2.5*(pgaLog10);
  mmi = Math.max(1, Math.min(10, mmi));

  let label:'Severe'|'Strong'|'Light'|'Weak' = 'Weak';
  if(mmi>=7.5) {label='Severe';}
  else if(mmi>=6) {label='Strong';}
  else if(mmi>=4.5) {label='Light';}

  return { distKm, etaSec, pEtaSec, mmi, label };
}



