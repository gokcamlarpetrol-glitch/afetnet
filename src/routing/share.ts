import { p2pLocalSend } from "../p2p/send";

export type SharedRoute = { id:string; coords:{lat:number;lng:number}[]; ts:number };

export async function broadcastRoute(r: SharedRoute){
  await p2pLocalSend({ kind:"route_share", v:1, r, ts: Date.now() });
}



