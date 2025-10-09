import { p2pLocalSend } from "../p2p/send";
import { DrawShape } from "./types";
import { addOrUpdateShape, deleteShape } from "./store";

export async function broadcastShape(s: DrawShape){
  await addOrUpdateShape(s);
  await p2pLocalSend({ kind:"draw_shape", v:1, s, ts: Date.now() });
}
export async function handleIncoming(msg:any){
  if(msg.kind==="draw_shape" && msg.s){ await addOrUpdateShape(msg.s as DrawShape); }
  if(msg.kind==="draw_del" && msg.id){ await deleteShape(String(msg.id)); }
}
