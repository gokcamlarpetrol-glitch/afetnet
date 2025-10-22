import { startPump } from './queue';
import { restartBleIfNeeded } from '../p2p/bleWatch';

let t:any=null;
export function startWatchdog(){
  if(t) {return;}
  startPump();
  t=(globalThis as any).setInterval(async()=>{ await restartBleIfNeeded(); }, 60_000);
}
export function stopWatchdog(){ if(t){ (globalThis as any).clearInterval(t); t=null; } }



