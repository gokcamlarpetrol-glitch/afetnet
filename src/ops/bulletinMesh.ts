import { p2pLocalSend } from "../p2p/send";
import { Bulletin, makeId } from "./types";
import { addBulletin } from "./bulletinStore";

export async function broadcastBulletin(b: Bulletin){
  await addBulletin(b);
  await p2pLocalSend({ kind:"bulletin", v:1, b, ts: Date.now() });
}
export async function handleIncoming(msg:any){
  if(msg.kind==="bulletin" && msg.b){ await addBulletin(msg.b as Bulletin); }
}



