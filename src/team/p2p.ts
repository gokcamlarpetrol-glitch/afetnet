import { p2pLocalSend } from '../p2p/send';
import { Approval } from './types';
export async function broadcastApproval(a: Approval){
  await p2pLocalSend({ kind:'approval_notice', v:1, ts: Date.now(), approval: a });
}



