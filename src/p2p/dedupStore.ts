const mem = new Map<string,number>(); // msgId -> ts

export function seenMsg(id:string){
  const now=Date.now();
  if(mem.has(id)){ return true; }
  mem.set(id,now);
  // prune old
  for(const [k,v] of Array.from(mem.entries())) {if(now-v>3600_000) {mem.delete(k);}}
  return false;
}



