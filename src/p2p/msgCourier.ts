/**
 * Uses Phase 37's BLE scanning cycle to exchange message bundles.
 * We pull from msg.outbox (to send/forward) and push to peers. We also accept incoming bundle -> appendInbox, mark ACKs.
 */
import { readOutboxBatch, appendInbox, appendOutbox, markAcked, isAcked } from "../msg/store";
import { Msg } from "../msg/types";
import * as FileSystem from "expo-file-system";
import { incr } from "../mesh/health";

const DIR = "/tmp/";
const RECV_IDS = DIR + "msg.recv.ids"; // dedup set

async function readRecvSet(): Promise<Set<string>>{
  const ex = await FileSystem.getInfoAsync(RECV_IDS);
  if(!ex.exists) {return new Set();}
  const txt = await FileSystem.readAsStringAsync(RECV_IDS);
  return new Set(txt.split("\n").filter(Boolean));
}
async function addRecv(ids:string[]){
  if(!ids.length) {return;}
  const ex = await FileSystem.getInfoAsync(RECV_IDS);
  const cur = ex.exists ? await FileSystem.readAsStringAsync(RECV_IDS) : "";
  const set = new Set(cur.split("\n").filter(Boolean));
  ids.forEach(id=>set.add(id));
  await FileSystem.writeAsStringAsync(RECV_IDS, Array.from(set).join("\n"));
}

export type MsgBundle = { v:1; items: Msg[]; acks?: string[] };

export async function buildOutgoing(max=10): Promise<MsgBundle>{
  const pool = await readOutboxBatch(200);
  // priority: SOS first, then encrypted, then others; keep max
  const sos = pool.filter(m=>m.kind==="sos");
  const enc = pool.filter(m=>m.kind!=="sos" && typeof m.body==="string" && m.body.startsWith("{\"_e2ee\""));
  const rest = pool.filter(m=>m.kind!=="sos" && !(typeof m.body==="string" && m.body.startsWith("{\"_e2ee\"")));
  const items = [...sos, ...enc, ...rest].slice(0, max);
  for(const m of items){ await incr({ kind:"msg_tx", hop: m.hops, sos: m.kind==="sos" }); }
  // attach pending ACKs from v2 queue (if needed extend later)
  return { v:1, items, acks: [] };
}

export async function acceptIncoming(b: MsgBundle){
  const idSet = await readRecvSet();
  const recvd: string[] = [];
  for(const m of b.items||[]){
    if(idSet.has(m.id)) { await incr({ kind:"dup_drop" }); continue; }
    // hop/ttl checks
    if((Date.now()-m.ts) > m.ttlSec*1000) {continue;}
    await appendInbox(m);
    await incr({ kind:"msg_rx", hop: m.hops, sos: m.kind==="sos" });
    recvd.push(m.id);
    // create ACK back
    const ack: Msg = { ...m, id: m.id+"#ack", ack: true, ackFor: m.id, body:"ACK", hops:0, maxHops: m.maxHops, ttlSec: 3600, ts: Date.now() };
    await appendOutbox(ack);
    await incr({ kind:"ack_tx" });
  }
  await addRecv(recvd);
  // mark ACKs we received
  for(const id of b.acks||[]){ await markAcked(id); await incr({ kind:"ack_rx" }); }
}

// Device short ID helper
export async function getDeviceShortId(): Promise<string>{
  // Use existing device ID from Phase 37 or generate a simple one
  try{
    const ex = await FileSystem.getInfoAsync(DIR + "device.id");
    if(ex.exists){
      return await FileSystem.readAsStringAsync(DIR + "device.id");
    }
  }catch{}
  // Generate a simple 8-char ID
  const id = Math.random().toString(36).slice(2,10).toUpperCase();
  await FileSystem.writeAsStringAsync(DIR + "device.id", id);
  return id;
}
