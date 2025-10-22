import { p2pLocalSend } from '../p2p/send';
import { SharedRoute } from './share';
export async function broadcastRoute(sr: SharedRoute){
  await p2pLocalSend({ kind:'route_share', v:1, ts: Date.now(), route: sr });
}



