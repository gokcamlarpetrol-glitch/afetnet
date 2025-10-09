import { p2pLocalSend } from "../p2p/send";
import { InvItem } from "./types";
import { loadInventory, saveInventory } from "./inventoryStore";

export async function broadcastInventory(){
  const arr = await loadInventory();
  await p2pLocalSend({ kind:"inv_full", v:1, items: arr, ts: Date.now() });
}

export async function handleIncoming(msg:any){
  if(msg.kind==="inv_full" && Array.isArray(msg.items)){
    // naive merge by id with "last-write-wins" using updated
    const local = await loadInventory();
    const map = new Map(local.map(x=>[x.id,x]));
    for(const r of msg.items as InvItem[]){
      const l = map.get(r.id);
      if(!l || (r.updated||0) > (l.updated||0)) {map.set(r.id, r);}
    }
    await saveInventory(Array.from(map.values()));
  }
}



