import { Accelerometer } from "expo-sensors";
import * as Location from "expo-location";
import { quantizeLatLng } from "../geo/coarse";
import { appendQuake, notifyQuake } from "./store";

let sub: any = null;
let buf: number[] = [];
let on=false;
export function startStaLta(){
  if(on) {return;} on=true;
  buf = [];
  Accelerometer.setUpdateInterval(50); // ~20 Hz
  let lastTs=0; let refractory=0;
  sub = Accelerometer.addListener(async({ x,y,z })=>{
    const now = Date.now();
    const g = Math.sqrt(x*x+y*y+z*z)-1; // remove gravity ~1g
    buf.push(Math.abs(g)); if(buf.length>400) {buf.shift();} // 20s buffer at 20Hz
    if(now<refractory) {return;}
    if(now-lastTs<100) {return;} lastTs=now;

    if(buf.length>=400){
      const sta = avg(buf.slice(-40));  // 2s
      const lta = avg(buf.slice(-400)); // 20s
      const ratio = lta>0.02 ? sta/lta : 0;
      if(ratio>=3.0 && sta>0.1){
        refractory = now + 60_000; // 60s lockout
        try{
          const p = await Location.getLastKnownPositionAsync({}); let lat=0, lng=0;
          if(p){ const q=quantizeLatLng(p.coords.latitude,p.coords.longitude); lat=q.lat; lng=q.lng; }
          const qk = { id:"LOCAL_"+now, ts:now, lat, lng, mag: Math.min(4.0, sta*10), src:"LOCAL" as const };
          await appendQuake(qk); await notifyQuake(qk);
        }catch{}
      }
    }
  });
}
export function stopStaLta(){ on=false; sub?.remove(); sub=null; }
function avg(a:number[]){ return a.reduce((s,x)=>s+x,0)/a.length; }



