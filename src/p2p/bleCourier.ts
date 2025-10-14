import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import { handleIncoming as drawHandle } from "../draw/mesh";
import { handleIncoming as helpHandle } from "../help/mesh";
import { incr } from "../mesh/health";
import { inboxWrite } from "../mesh/queue";
import { handleIncoming as bullHandle } from "../ops/bulletinMesh";
import { handleIncoming as invHandle } from "../ops/inventoryMesh";
import { handleIncoming as taskHandle } from "../ops/taskMesh";
import { setNeighborCount } from "../p2p/peers";
import { paramsFor } from "../profile/params";
import { handleEEWIncoming } from "../quake/mesh";
import { list, stats } from "../queue/v2";
import { handleIncoming as occHandle } from "../relief/occupancy";
import { addReceived } from "../route/share";
import { handleIncoming as roadHandle } from "../routing/mesh";
import { handleIncoming as shareHandle } from "../share/mesh";
import { serveChunks } from "../share/sender";
import { getRxStates, handleChunk, requestMissing } from "../share/transfer";
import { useProfile } from "../state/profileStore";
import { upsertTask } from "../tasks/store";
import { upsertApproval } from "../team/store";
import { ackULB } from "../ulb/api";
import { logger } from '../utils/productionLogger';
import { p2pLocalSend } from "./send";
import { CourierBundle, CourierPacket, P2P_CHAR_INBOX, P2P_CHAR_OUTBOX, P2P_SERVICE, P2PHello } from "./types";

// Safe BLE manager to prevent crashes when native modules are not available
let BleManager: any = null;
let MANAGER: any = null;

try {
  const blePlx = require("react-native-ble-plx");
  BleManager = blePlx.BleManager;
  MANAGER = new BleManager();
} catch (e) {
  logger.warn("react-native-ble-plx not available, using fallback");
}
let running = false;
let dutyTimer: any = null;
const knownPeers = new Set<string>();
let didShort = "unk";
let convoy = [] as { id:string; lat:number; lng:number; ts:number }[];
export function getConvoy(){ return convoy; }
let sharedRoutes = [] as { id:string; coords:{lat:number;lng:number}[]; ts:number }[];
let offers: unknown[] = [];
let relayOn=false;
export function getSharedRoutes(){ return sharedRoutes; }
export function getOffers(){ return offers; }
export function setRelay(on:boolean){ relayOn=on; }
export function debugP2P(){ return { offers, convoy, sharedRoutes, rx: getRxStates(), relayOn }; }
export function __presence_debug(){ return PRES_MEM; }
(global as typeof globalThis).__AFN_BLE_RESTART__ = ()=>{ /* no-op placeholder; could reinit BLE manager here */ };

function getDuty(){ const p = useProfile.getState().profile; return paramsFor(p); }

const DIR = "/tmp/";
const RECV_DB = DIR + "p2p.received.ids"; // newline separated ids for dedup

// loop guard by msg.id memory
const seenIds = new Set<string>();
const seenPeers = new Set<string>();
const PRES_MEM: Record<string, {last:number}> = {};
function seen(id:any){ const s=String(id); if(seenIds.has(s)) {return true;} seenIds.add(s); setTimeout(()=>seenIds.delete(s), 60*60*1000); return false; }

async function deviceShortId(){
  if(didShort !== "unk") {return didShort;}
  const rnd = Math.random().toString(36) + Date.now().toString(36);
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rnd);
  didShort = h.slice(0,8);
  return didShort;
}

async function readRecvSet(): Promise<Set<string>>{
  const info = await FileSystem.getInfoAsync(RECV_DB);
  if(!info.exists) {return new Set();}
  const txt = await FileSystem.readAsStringAsync(RECV_DB);
  return new Set(txt.split("\n").filter(Boolean));
}
async function addRecv(ids: string[]){
  if(!ids.length) {return;}
  const cur = await FileSystem.readAsStringAsync(RECV_DB).catch(()=> "");
  const set = new Set(cur.split("\n").filter(Boolean));
  ids.forEach(id=>set.add(id));
  await FileSystem.writeAsStringAsync(RECV_DB, Array.from(set).join("\n"));
}

function toB64(obj:any){ return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function fromB64<T=any>(b64:string): T {
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export async function startP2P(){
  if(running) {return;}
  running = true;
  knownPeers.clear();
  await ensurePermissions();
  await cycle(); // kick once
}

export function stopP2P(){
  running = false;
  clearTimeout(dutyTimer);
  MANAGER.stopDeviceScan();
}

async function ensurePermissions(){
  // react-native-ble-plx handles prompts; no-op placeholder for clarity.
}

async function advertiseHello(){
  // plx does not expose raw advertiser API cross-platform; we piggyback via device name & scan response manufacturer data.
  // Strategy: encode small hello as local name fragment (safe & discoverable).
  const meta = await stats();
  const hello: P2PHello = { v:1, did: await deviceShortId(), p: meta.pending };
  // On iOS, the OS handles advertiser from Info.plist; for demo we rely on scan+connect where we send bundle over GATT.
  return hello;
}

async function buildBundle(max=10): Promise<CourierBundle>{
  const did = await deviceShortId();
  const recv = await readRecvSet();
  const pending = await list(200, false);
  const items: CourierPacket[] = [];
  for(const r of pending){
    if(r.kind !== "sos" && r.kind !== "status") {continue;}
    if(recv.has(r.id)) {continue;} // don't forward ones we already received from someone
    const compact: CourierPacket = {
      v:1, id: r.id, ts: r.ts, kind: r.kind, payload: r.payload, hash: r.hash
    };
    items.push(compact);
    if(items.length >= max) {break;}
  }
  return { v:1, from: did, items };
}

async function handleDevice(dev: any){
  if(knownPeers.has(dev.id)) {return;}
  knownPeers.add(dev.id);
  try{
    const conn = await MANAGER.connectToDevice(dev.id, { timeout: 6000 });
    await conn.discoverAllServicesAndCharacteristics();
    const services = await conn.services();
    const has = services.find((s: any)=>s.uuid.toUpperCase().includes(P2P_SERVICE.replace(/-/g,"")));
    // Even if service is not found (platform/advert limits), still try chars by UUID known path.
    const outPayload = await buildBundle(12);
    if(outPayload.items.length){
      const b64 = toB64(outPayload);
      // chunk if necessary
      const CHUNK = 160; // base64 safe chunk
      for(let i=0;i<b64.length;i+=CHUNK){
        const part = b64.slice(i, i+CHUNK);
        await conn.writeCharacteristicWithoutResponseForService(P2P_SERVICE, P2P_CHAR_INBOX, part);
      }
      // terminator
      await conn.writeCharacteristicWithoutResponseForService(P2P_SERVICE, P2P_CHAR_INBOX, toB64({ end:true }));
      await incr({ kind:"bundle_tx", peer: dev.id });
    }
    // Try read peer outbox
    let peerAggregate = "";
    try{
      const ch: any = await conn.readCharacteristicForService(P2P_SERVICE, P2P_CHAR_OUTBOX);
      peerAggregate += ch.value ?? "";
    }catch{}
    if(peerAggregate){
      const bundle = fromB64<CourierBundle>(peerAggregate);
      const ids = bundle.items?.map(i=>i.id) ?? [];
      await addRecv(ids);
      // DON'T append duplicates into our own queue; deliver into a local "inbox" file for UI / map (Phase 38).
      await FileSystem.writeAsStringAsync(DIR+"p2p.inbox.json", JSON.stringify(bundle));
      await incr({ kind:"bundle_rx", peer: dev.id });
      
      // Handle task notices if present
      if((bundle as any).task){
        try{
          await upsertTask((bundle as any).task);
        }catch{ /* ignore task errors */ }
      }
      
      // Handle route shares if present
      if((bundle as any).route){
        try{
          await addReceived((bundle as any).route);
        }catch{ /* ignore route errors */ }
      }
      
      // Handle approval notices if present
      if((bundle as any).approval){
        try{
          await upsertApproval((bundle as any).approval);
        }catch{ /* ignore approval errors */ }
      }
      
      // Handle family messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("fam_"))){
      }
      
      // Handle help messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("help_"))){
        try{
          await helpHandle(bundle);
        }catch{ /* ignore help errors */ }
      }
      
      // Handle inventory messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("inv_"))){
        try{
          await invHandle(bundle);
        }catch{ /* ignore inventory errors */ }
      }
      
      // Handle task messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("task_"))){
        try{
          await taskHandle(bundle);
        }catch{ /* ignore task errors */ }
      }
      
      // Handle convoy pings
      if((bundle as any).kind==="convoy_ping" && (bundle as any).id && (bundle as any).lat && (bundle as any).lng){
        convoy = convoy.filter(x=> Date.now()-x.ts < 10*60*1000);
        convoy.push({ id: String((bundle as any).id), lat: Number((bundle as any).lat), lng: Number((bundle as any).lng), ts: Number((bundle as any).ts)||Date.now() });
      }
      
      // Handle bulletin messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("bulletin"))){
        try{
          await bullHandle(bundle);
        }catch{ /* ignore bulletin errors */ }
      }
      
      // Handle road messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("road_"))){
        try{
          await roadHandle(bundle);
        }catch{ /* ignore road errors */ }
      }
      
      // Handle drawing messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("draw_"))){
        try{
          await drawHandle(bundle);
        }catch{ /* ignore drawing errors */ }
      }
      
      // Handle occupancy messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("fac_"))){
        try{
          await occHandle(bundle);
        }catch{ /* ignore occupancy errors */ }
      }
      
      // Handle pack offer messages if present
      if((bundle as any).kind && ((bundle as any).kind.startsWith("pack_"))){
        try{
          await shareHandle(bundle);
          if((bundle as any).kind==="pack_offer" && (bundle as any).off){ 
            offers = offers.filter((o: any)=> Date.now()-o.ts < 6*60*60*1000);
            offers.push((bundle as any).off);
          }
        }catch{ /* ignore share errors */ }
      }
      
      // Handle pack request messages
      if((bundle as any).kind==="pack_req" && (bundle as any).id && Array.isArray((bundle as any).need)){
        // find matching offer (same id prefix or any)
        const off = offers.find((o: any)=> o.id===(bundle as any).id || o.man?.name?.includes((bundle as any).id));
        if(off){ serveChunks((off as any).man, { id: (bundle as any).id, need: (bundle as any).need }).catch(()=>{}); }
      }
      
      // Handle pack chunk messages
      if((bundle as any).kind==="pack_chunk" && (bundle as any).id && ((bundle as any).idx!=null) && (bundle as any).b64){
        handleChunk((bundle as any).id, Number((bundle as any).idx), String((bundle as any).b64)).catch(()=>{});
        // backpressure: request more if still missing
        setTimeout(()=> requestMissing((bundle as any).id).catch(()=>{}), 1000);
      }
      
      // Handle ULB messages and auto-ack
      if((bundle as any).kind==="ulb_msg" && (bundle as any).id){
        // auto-ack if addressed to me or broadcast
        ackULB(String((bundle as any).id)).catch(()=>{});
      }
      
      // Handle EEW alerts
      if((bundle as any).kind==="eew_alert"){
        handleEEWIncoming(bundle).catch(()=>{});
      }
      
      // Handle presence messages
      if((bundle as any).kind==="presence" && (bundle as any).id){
        PRES_MEM[String((bundle as any).id)] = { last: Date.now() };
      }
      
      // Neighbor count tracking
      if((bundle as any) && (bundle as any)._from){ 
        if(!seenPeers.has((bundle as any)._from)){ 
          seenPeers.add((bundle as any)._from); 
          setNeighborCount(seenPeers.size); 
          setTimeout(()=>{ seenPeers.delete((bundle as any)._from); setNeighborCount(seenPeers.size); }, 60_000); 
        } 
      }
      
      // Relay functionality with loop guard
      if((bundle as any) && (bundle as any).id && !seen((bundle as any).id)){ 
        inboxWrite(bundle).catch(()=>{});
        if(relayOn){ // relay once
          if((bundle as any).kind==="ulb"||(bundle as any).kind==="ulb_ack"||(bundle as any).kind==="route_share"||(bundle as any).kind==="pack_offer"||(bundle as any).kind==="pack_chunk"||(bundle as any).kind==="pack_req"){
            // re-broadcast small payloads only
            p2pLocalSend(bundle).catch(()=>{});
          }
        }
      }
      
      // Handle route share messages
      if((bundle as any).kind==="route_share" && (bundle as any).r){
        sharedRoutes = sharedRoutes.filter(x=> Date.now()-x.ts < 6*60*60*1000);
        sharedRoutes.push((bundle as any).r);
      }
    }
    await conn.cancelConnection();
  }catch{
    // ignore
  }
}

async function scanOnce(){
  const hello = await advertiseHello(); // not used directly, but keeps meta updated
  const duty = getDuty();
  return new Promise<void>((resolve)=>{
    MANAGER.startDeviceScan([P2P_SERVICE], { allowDuplicates: false }, async (_error: Error | unknown, device: any) => {
      if(!running){ MANAGER.stopDeviceScan(); resolve(); return; }
      if(device){ handleDevice(device); }
    });
    setTimeout(()=>{
      MANAGER.stopDeviceScan();
      resolve();
    }, duty.bleScanMs);
  });
}

async function cycle(){
  if(!running) {return;}
  await scanOnce();
  dutyTimer = setTimeout(()=>cycle(), getDuty().bleSleepMs);
}

export async function getDeviceShortId(){
  return await deviceShortId();
}
