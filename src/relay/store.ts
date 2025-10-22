import AsyncStorage from '@react-native-async-storage/async-storage';

export type RelayMsg = {
  id: string;             // global id (uuid or hash)
  id16: number;           // 16-bit short id for BLE v2
  ttl: number;            // remaining hops
  hops: number;           // hops traversed
  kind: 'text'|'thumb';
  text?: string;          // UTF-8 text
  blobB64?: string;       // small JPEG base64 (optional)
  src: string;            // device id or hash
  ts: number;
  seen: Record<string, number>; // medium -> ts (e.g., "ble","p2p")
};

const KEY = 'relay:store:v1';
const CAP = 200; // max messages
let mem: RelayMsg[] = [];

export async function load(){ try{
  const raw = await AsyncStorage.getItem(KEY);
  mem = raw ? JSON.parse(raw) : [];
} catch { mem = []; } }

export async function save(){ try{
  await AsyncStorage.setItem(KEY, JSON.stringify(mem.slice(-CAP)));
} catch {
  // Ignore storage errors
} }

export function getAll(){ return mem.slice(); }

export function hasId16(id16:number){ return mem.some(m=>m.id16===id16); }

export function put(msg: RelayMsg){
  // dedupe by id
  const i = mem.findIndex(m=>m.id===msg.id);
  if (i>=0){
    // update ttl/hops minimally (keep the higher ts)
    mem[i].ttl = Math.max(mem[i].ttl, msg.ttl);
    mem[i].hops = Math.min(mem[i].hops, msg.hops);
    mem[i].seen = { ...mem[i].seen, ...msg.seen };
  } else {
    mem.push(msg);
    if (mem.length>CAP) {mem.shift();}
  }
}

export function tickTTL(){
  // prune expired (ttl<=0 and old)
  const now = Date.now();
  mem = mem.filter(m => m.ttl>0 || (now - m.ts) < 30*60*1000);
}

export function markSeen(id: string, medium: 'ble'|'p2p'){ const m = mem.find(x=>x.id===id); if (m) {m.seen[medium]=Date.now();} }

export function nextForBle(): RelayMsg | null {
  // choose a message that still has ttl>0 and not recently sent on BLE
  const now = Date.now();
  const cand = mem.find(m => m.ttl>0 && ((now - (m.seen['ble']||0)) > 10_000));
  return cand || null;
}

export function nextForP2P(): RelayMsg | null {
  const now = Date.now();
  const cand = mem.find(m => m.ttl>0 && ((now - (m.seen['p2p']||0)) > 5_000));
  return cand || null;
}

export function decTTL(id: string){ const m = mem.find(x=>x.id===id); if (m){ m.ttl = Math.max(0, m.ttl-1); m.hops += 1; } }



