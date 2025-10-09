import { p2pLocalSend } from "../p2p/send";
export async function broadcastULB(encoded: Uint8Array){
  // split to <= 180 bytes
  const max = 180;
  for(let i=0;i<encoded.length;i+=max){
    const part = Array.from(encoded.slice(i, i+max));
    await p2pLocalSend({ kind:"ulb_msg", v:1, ts: Date.now(), part, more: i+max<encoded.length });
  }
}



