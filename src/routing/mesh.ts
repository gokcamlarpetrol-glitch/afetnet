import { p2pLocalSend } from '../p2p/send';
import { Closure } from './types';
import { addClosure } from './store';

export async function broadcastClosure(c: Closure){
  await addClosure(c);
  await p2pLocalSend({ kind:'road_closure', v:1, c, ts: Date.now() });
}
export async function handleIncoming(msg:any){
  if(msg.kind==='road_closure' && msg.c){ await addClosure(msg.c as Closure); }
}



