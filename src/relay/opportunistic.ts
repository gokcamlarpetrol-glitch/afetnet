import getP2P, { _p2pInst } from "../p2p/P2P.native";
import * as RStore from "./../relay/store";

let on = false, t: any=null;

export async function startP2PRelay(){
  if (on) {return;} on = true;
  await RStore.load();
  const p2p = getP2P();
  await p2p.start({
    onMessage: async (_from: string, text: string) => {
      const id = "p2p:"+Date.now()+":"+Math.random().toString(36).slice(2,6);
      const id16 = Math.floor(Math.random()*65535);
      RStore.put({ id, id16, ttl: 2, hops: 0, kind:"text", text, src:"p2p", ts: Date.now(), seen:{} });
      await RStore.save();
    }
  } as any);
  t = setInterval(async ()=>{
    const m = RStore.nextForP2P();
    if (!m) {return;}
    try{
      await _p2pInst?.sendText?.("*", m.text || ""); // if adapter supports broadcast; else skip silently
      RStore.markSeen(m.id, "p2p");
      RStore.decTTL(m.id);
      await RStore.save();
    }catch{}
  }, 5000);
}

export function stopP2PRelay(){
  on = false;
  if (t) {clearInterval(t), t=null;}
}
