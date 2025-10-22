import * as FileSystem from 'expo-file-system';

const DIR = '/tmp/';
const FILE = DIR + 'mesh.health.json';
const BUCKET_MS = 5*60*1000; // 5 dk

export type HealthTotals = {
  peers_seen: number;
  bundles_tx: number; bundles_rx: number;
  msgs_tx: number; msgs_rx: number;
  relayed: number;
  acks_tx: number; acks_rx: number;
  dup_dropped: number;
  sum_hop_out: number; cnt_hop_out: number;
  sum_hop_in: number; cnt_hop_in: number;
};

export type PeerSeen = { id:string; last:number; count:number };

export type HealthDoc = {
  v:1;
  totals: HealthTotals;
  peers: Record<string, PeerSeen>;
  buckets: { t:number; tx:number; rx:number; sos:number; }[]; // rolling 24h
  last_gc?: number;
};

function emptyTotals(): HealthTotals {
  return { peers_seen:0, bundles_tx:0, bundles_rx:0, msgs_tx:0, msgs_rx:0, relayed:0, acks_tx:0, acks_rx:0, dup_dropped:0, sum_hop_out:0, cnt_hop_out:0, sum_hop_in:0, cnt_hop_in:0 };
}

async function load(): Promise<HealthDoc>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return { v:1, totals: emptyTotals(), peers:{}, buckets:[] };}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ return { v:1, totals: emptyTotals(), peers:{}, buckets:[] }; }
}
async function save(doc: HealthDoc){ await FileSystem.writeAsStringAsync(FILE, JSON.stringify(doc)); }

function bucketKey(ts:number){ return Math.floor(ts/BUCKET_MS)*BUCKET_MS; }

export async function incr(ev: { t?:number; peer?:string; kind: 'bundle_tx'|'bundle_rx'|'msg_tx'|'msg_rx'|'relayed'|'ack_tx'|'ack_rx'|'dup_drop'; hop?:number; sos?:boolean }){
  const now = ev.t ?? Date.now();
  const doc = await load();
  const tot = doc.totals;
  const peers = doc.peers;

  if(ev.peer){
    const p = peers[ev.peer] || { id: ev.peer, last: now, count: 0 };
    p.last = now; p.count++; peers[ev.peer] = p;
  }

  switch(ev.kind){
  case 'bundle_tx': tot.bundles_tx++; break;
  case 'bundle_rx': tot.bundles_rx++; break;
  case 'msg_tx': tot.msgs_tx++; if(typeof ev.hop==='number'){ tot.sum_hop_out+=ev.hop; tot.cnt_hop_out++; } break;
  case 'msg_rx': tot.msgs_rx++; if(typeof ev.hop==='number'){ tot.sum_hop_in+=ev.hop; tot.cnt_hop_in++; } break;
  case 'relayed': tot.relayed++; break;
  case 'ack_tx': tot.acks_tx++; break;
  case 'ack_rx': tot.acks_rx++; break;
  case 'dup_drop': tot.dup_dropped++; break;
  }

  const bk = bucketKey(now);
  let b = doc.buckets.find(x=>x.t===bk);
  if(!b){ b = { t: bk, tx:0, rx:0, sos:0 }; doc.buckets.push(b); }
  if(ev.kind==='msg_tx') {b.tx++;}
  if(ev.kind==='msg_rx') {b.rx++;}
  if(ev.sos) {b.sos++;}

  // GC: keep last 24h
  const limit = now - 24*60*60*1000;
  if(!doc.last_gc || now - doc.last_gc > 10*60*1000){
    doc.buckets = doc.buckets.filter(x=>x.t>=limit).sort((a,b)=>a.t-b.t);
    doc.last_gc = now;
  }

  // peers_seen = unique peers with last within 24h
  tot.peers_seen = Object.values(peers).filter(p=>p.last>=limit).length;

  await save(doc);
}

export async function readHealth(): Promise<{ totals: HealthTotals & { success_rate:number; avg_hop_out:number; avg_hop_in:number }; peers: PeerSeen[]; buckets: HealthDoc['buckets'] }>{
  const doc = await load();
  const t = doc.totals;
  const success = t.msgs_tx>0 ? t.acks_tx / t.msgs_tx : 0;
  const hopOut = t.cnt_hop_out>0 ? t.sum_hop_out/t.cnt_hop_out : 0;
  const hopIn  = t.cnt_hop_in>0 ? t.sum_hop_in/t.cnt_hop_in : 0;
  const peers = Object.values(doc.peers).sort((a,b)=>b.last-a.last).slice(0,100);
  return { totals: { ...t, success_rate: success, avg_hop_out: hopOut, avg_hop_in: hopIn }, peers, buckets: doc.buckets };
}



