import { p2pLocalSend } from "../p2p/send";
let t:any=null;
export function startPresenceBeacon(id:string){
  if(t) {clearInterval(t);}
  t = setInterval(async()=>{ await p2pLocalSend({ kind:"presence", v:1, id, ts: Date.now() }); }, 15_000);
}
export function stopPresenceBeacon(){ if(t){ clearInterval(t); t=null; } }



