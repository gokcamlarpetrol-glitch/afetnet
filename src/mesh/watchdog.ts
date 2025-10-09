import { startPump } from "./queue";
import { restartBleIfNeeded } from "../p2p/bleWatch";

let t:any=null;
export function startWatchdog(){
  if(t) {return;}
  startPump();
  t=setInterval(async()=>{ await restartBleIfNeeded(); }, 60_000);
}
export function stopWatchdog(){ if(t){ clearInterval(t); t=null; } }



