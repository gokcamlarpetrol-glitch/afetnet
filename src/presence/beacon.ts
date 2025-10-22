import { p2pLocalSend } from '../p2p/send';
let t:any=null;
export function startPresenceBeacon(id:string){
  if(t) {(globalThis as any).clearInterval(t);}
  t = (globalThis as any).setInterval(async()=>{ await p2pLocalSend({ kind:'presence', v:1, id, ts: Date.now() }); }, 15_000);
}
export function stopPresenceBeacon(){ if(t){ (globalThis as any).clearInterval(t); t=null; } }



