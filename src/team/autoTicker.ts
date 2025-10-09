import { broadcastTeamLocation } from "../ble/bridge";

let t:any=null, on=false;
export function startTicker(periodMs=15000){
  if (on) {return;} on=true;
  t=setInterval(()=>{ broadcastTeamLocation().catch(()=>{}); }, Math.max(5000, periodMs));
}
export function stopTicker(){ if (t){ clearInterval(t); t=null; } on=false; }
export function isOn(){ return on; }



