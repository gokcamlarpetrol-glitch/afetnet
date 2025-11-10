import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { quantizeLatLng } from '../geo/coarse';
import { EEWAlert } from './types';
import { pushEEW, notifyEEW } from './store';

/** Simplified P-wave detector:
 * High-pass-ish transform on |a|-1g, STA(0.6s)/LTA(8s) ratio ≥ 2.2 for ≥0.8s triggers.
 * Refractory 90s to avoid repeat. This is heuristic, not an official warning.
*/
let on=false; let sub:any=null;
let buf:number[]=[]; let refUntil=0; let overCount=0;

export function startLocalPwave(){
  if(on) {return;} on=true; buf=[]; refUntil=0; overCount=0;
  Accelerometer.setUpdateInterval(20); // ~50Hz
  sub = Accelerometer.addListener(async({ x,y,z })=>{
    const now=Date.now(); if(now<refUntil) {return;}
    const g = Math.sqrt(x*x+y*y+z*z)-1;
    // crude high-pass: absolute small values only
    const v = Math.max(0, Math.abs(g)-0.02);
    buf.push(v); if(buf.length>400) {buf.shift();} // 8s @50Hz
    if(buf.length<400) {return;}

    const sta = avg(buf.slice(-30));  // ~0.6s
    const lta = avg(buf.slice(-400)); // ~8s
    const ratio = lta>0.01 ? sta/lta : 0;
    if(ratio>=2.2 && sta>0.04){ overCount++; } else { overCount=Math.max(0,overCount-1); }
    if(overCount>=40){ // ~0.8s sustained
      refUntil = now + 90_000; overCount=0;
      try{
        const p = await Location.getLastKnownPositionAsync({}); let lat=0, lng=0;
        if(p){ const q=quantizeLatLng(p.coords.latitude,p.coords.longitude); lat=q.lat; lng=q.lng; }
        const a: EEWAlert = { id:'LOCAL_P_'+now, ts: now, lat, lng, depth: 5, mag: 3.5, src:'LOCAL_PWAVE' };
        await pushEEW(a); await notifyEEW(a);
      }catch{
        // Ignore location errors
      }
    }
  });
}

export function stopLocalPwave(){ on=false; sub?.remove(); sub=null; }
function avg(a:number[]){ return a.reduce((s,x)=>s+x,0)/a.length; }



