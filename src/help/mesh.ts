import { p2pLocalSend } from '../p2p/send';
import { HelpTicket } from '../relief/types';
import { addTicket } from './store';

export async function broadcastTicket(t: HelpTicket){
  await addTicket(t);
  await p2pLocalSend({ kind:'help_ticket', v:1, t, ts: Date.now() });
}

export async function handleIncoming(msg:any){
  if(msg.kind==='help_ticket' && msg.t){ await addTicket(msg.t as HelpTicket); }
  if(msg.kind==='help_status' && msg.tid && msg.patch){ /* best-effort status propagation */ }
}



