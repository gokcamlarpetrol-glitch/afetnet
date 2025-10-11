import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { noteSOS } from "../heat/heatstore";
import { getDeviceId, short16 } from "../lib/device";
import * as RStore from "../relay/store";
import { decryptText, encryptText, setGroupPin as setGroupPinGroup } from "../security/group";
import { listPeers, openFrom, sealFor } from "../security/keys";
import { markBlePacket } from "../watchdogs/core";
import * as Native from "./ble.native";
let peerCache: Record<string,string> = {};

export type NearbyFrame = { id:string; lat?:number; lon?:number; batt?:number; txt?:string; ts?:number };
type Events = {
  onNearby?: (frames: {id:string; lat?:number; lon?:number; batt?:number; txt?:string}[]) => void;
  onError?: (msg:string)=>void;
};
const frames: Record<string, any> = {};
export function getNearbyFrames(): NearbyFrame[] { return Object.values(frames); }
let seq = Math.floor(Math.random()*255);
let groupPin = ""; // optional XOR mask
let dutyCycle = { scanMs: 6000, pauseMs: 4000 };
let scanning = false;
let relayMode = false;
let deviceId = "afn-node";

export function setDutyCycle(scan:number, pause:number){ dutyCycle = { scanMs: scan, pauseMs: pause }; }
export async function rememberDuty(){ await AsyncStorage.setItem("afn:duty:last", JSON.stringify({ scan: dutyCycle.scanMs, pause: dutyCycle.pauseMs })); }
export function setRelayMode(v:boolean){ relayMode = v; }

export function setGroupPin(pin: string){ groupPin = (pin||"").slice(0,6); }
export async function setGroupPinCrypto(pin: string){ await setGroupPinGroup(pin); }

function mask(data: Uint8Array){
  if (!groupPin) {return data;}
  const out = new Uint8Array(data.length);
  for (let i=0;i<data.length;i++){ 
    const charIndex = i % groupPin.length;
    const charCode = groupPin.charCodeAt(charIndex);
    if (charCode !== undefined) {
      const dataValue = data[i];
      if (dataValue !== undefined) {
        out[i] = dataValue ^ charCode; 
      } else {
        out[i] = 0;
      }
    } else {
      const dataValue = data[i];
      out[i] = dataValue ?? 0;
    }
  }
  return out;
}

export async function start(events: Events){
  deviceId = await getDeviceId();
  await RStore.load();
  if(scanning) {return;}
  scanning = true;
  peerCache = await listPeers();
  const loop = async()=>{
    while(scanning){
      await Native.startScan(async (id: string, frame: any)=>{
        markBlePacket();
        if (frame.t==="loc"){
          frames[id] = { id, lat: frame.lat, lon: frame.lon, batt: frame.batt, ts: Date.now() };
          // Konumlu çerçeve SOS bağlamında olabilir; sırf konum not etmek istemiyorsak atla.
        } else if (frame.t==="sos"){
          frames[id] = { 
            id, 
            lat: frame.lat, 
            lon: frame.lon, 
            batt: frame.batt, 
            ts: Date.now(),
            statuses: frame.statuses || []
          };
        } else if (frame.t==="loc2"){
          // Try group decrypt → JSON decode
          const plain = decryptText(new Uint8Array(frame.payload));
          if (plain){
            try{
              const obj = JSON.parse(Buffer.from(plain).toString("utf8"));
              if (obj && obj.lat!=null && obj.lon!=null){
                frames[id] = { id, lat: obj.lat, lon: obj.lon, acc: obj.acc, batt: obj.batt, ts: obj.ts || Date.now(), team: true };
              }
            }catch{}
          }
        } else if (frame.t==="txt"){
          const key = id+"#"+frame.seq;
          const bucket = (frames[key] ||= { id, chunks: [], total: frame.total, ts: Date.now() });
          bucket.chunks[frame.idx] = frame.payload;
          if (bucket.chunks.filter(Boolean).length === frame.total){
            const merged = Buffer.concat(bucket.chunks.map((u:Uint8Array)=>Buffer.from(u)));
            // Try decrypt with E2E peer keys first
            const pub = peerCache[id];
            if (pub) {
              const plain = await openFrom(pub, new Uint8Array(merged));
              if (plain) { frames[id+"#lastTxt"] = { id, txt: Buffer.from(plain).toString("utf8"), ts: Date.now() }; return; }
            }
            // Else try group key decryption
            const grp = decryptText(new Uint8Array(merged));
            if (grp) { frames[id+"#lastTxt"] = { id, txt: Buffer.from(grp).toString("utf8"), ts: Date.now() }; }
            else { frames[id+"#lastTxt"] = { id, txt: "(şifreli)", ts: Date.now() }; }
            // Metin içinde SOS/HLP anahtarları (çok basit) → heat'e yaz (konum bilmiyorsak atla)
            const last = frames[id];
            if (last?.lat!=null && last?.lon!=null){
              const mergedTxt = frames[id+"#lastTxt"]?.txt || "";
              if (/\b(SOS|YARDIM|HELP)\b/i.test(mergedTxt)){ try{ await noteSOS(last.lat, last.lon, 1); }catch{} }
            }
            // Opportunistic ingest: create RelayMsg with fresh TTL only if relayMode
            if (relayMode){
              const txt = frames[id+"#lastTxt"]?.txt || "";
              const rid = deviceId + ":" + Date.now() + ":" + Math.random().toString(36).slice(2,6);
              const id16 = short16(rid);
              RStore.put({ id: rid, id16, ttl: 2, hops: 0, kind:"text", text: txt, src: id, ts: Date.now(), seen: {} });
              await RStore.save();
            }
          }
        } else if (frame.t==="txt2"){
          // v2 frames with TTL/hops and id16
          const key = id+"#"+frame.id16;
          const bucket = (frames[key] ||= { id, id16: frame.id16, ttl: frame.ttl, hops: frame.hops, chunks: [], total: frame.total, ts: Date.now() });
          bucket.chunks[frame.idx] = frame.payload;
          if (bucket.chunks.filter(Boolean).length === frame.total){
            const merged = Buffer.concat(bucket.chunks.map((u:Uint8Array)=>Buffer.from(u)));
            // text may be group-encrypted
            let text = "(şifreli)";
            const grp = decryptText(new Uint8Array(merged));
            if (grp) {text = Buffer.from(grp).toString("utf8");} else {text = Buffer.from(merged).toString("utf8");}
            frames[id+"#lastTxt2"] = { id, txt: text, ts: Date.now() };
            const last = frames[id];
            if (last?.lat!=null && last?.lon!=null){
              const mergedTxt = frames[id+"#lastTxt2"]?.txt || "";
              if (/\b(SOS|YARDIM|HELP)\b/i.test(mergedTxt)){ try{ await noteSOS(last.lat, last.lon, 1); }catch{} }
            }
            if (relayMode){
              const rid = deviceId + ":" + frame.id16 + ":" + Date.now();
              RStore.put({ id: rid, id16: frame.id16, ttl: Math.max(0, frame.ttl-1), hops: frame.hops+1, kind:"text", text, src: id, ts: Date.now(), seen: { ble: Date.now() } });
              await RStore.save();
            }
          }
        }
        events.onNearby?.(Object.values(frames));
      });
      await new Promise(r=>setTimeout(r, dutyCycle.scanMs));
      await Native.stopScan();
      // Relay scheduler: after each scan window, optionally rebroadcast one message
      if (relayMode){
        RStore.tickTTL();
        const m = RStore.nextForBle();
        if (m){
          // bleed one chunk via v2 (ttl decremented after send)
          const payload = Buffer.from((m.text || "").slice(0,220), "utf8"); // small slice for demo
          const enc = encryptText(new Uint8Array(payload)); // group encryption if set
          const chunk = 10; const total = Math.ceil(enc.length/chunk);
          for (let i=0;i<total;i++){
            const part = enc.subarray(i*chunk, Math.min(enc.length,(i+1)*chunk));
            const pkt = Native.encodeTextV2(m.id16, m.ttl, m.hops, i, total, new Uint8Array(part));
            await Native.advertise(mask(pkt));
            await new Promise(r=>setTimeout(r, 160));
          }
          await new Promise(r=>setTimeout(r, 1000));
          await Native.stopAdvertise();
          RStore.markSeen(m.id, "ble");
          RStore.decTTL(m.id);
          await RStore.save();
        }
      }
      await new Promise(r=>setTimeout(r, dutyCycle.pauseMs));
    }
  };
  loop();
}

export async function stop(){ 
  scanning = false;
  await Native.stopScan(); 
}

export async function broadcastSOS(getBatt:()=>number, statuses: string[] = []){
  try{
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status!=="granted") {throw new Error("Konum izni yok");}
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = fix.coords.latitude, lon = fix.coords.longitude, batt = getBatt();
    
    // Create payload with statuses (for debugging/logging)
    // const _payload = {
    //   type: "SOS",
    //   uuid: deviceId,
    //   ts: Date.now(),
    //   statuses: statuses,
    //   battery: batt,
    //   signal: 100 // placeholder signal strength
    // };
    
    // Use appropriate encoder based on whether statuses are provided
    const pkt = statuses.length > 0 
      ? Native.encodeSOSWithStatus(lat, lon, batt, statuses)
      : Native.encodeLocation(lat, lon, batt, seq++ & 0xff);
    
    // Store status information for later retrieval
    await AsyncStorage.setItem("last_sos", JSON.stringify({
      lat, lon, ts: Date.now(), statuses: statuses
    }));
    
    await Native.advertise(mask(pkt));
    // auto-stop after 10s to save battery
    setTimeout(()=>{ Native.stopAdvertise().catch(()=>{}); }, 10000);
  }catch(e:any){}
}

export async function broadcastText(text: string){
  const bytes = Buffer.from(text,"utf8");
  const peers = await listPeers();
  const pkeys = Object.values(peers);
  let payload = bytes;
  if (pkeys.length>0){
    const firstKey = pkeys[0];
    if (firstKey) {
      const blob = await sealFor(firstKey, bytes);
      payload = Buffer.from(blob);
    }
  }
  else {
    // If no individual E2E peer, try group encryption
    payload = Buffer.from(encryptText(payload));
  }
  const chunk = 12;
  const total = Math.ceil(payload.length/chunk);
  const s = seq++ & 0xff;
  for (let i=0;i<total;i++){
    const part = payload.subarray(i*chunk, Math.min(payload.length,(i+1)*chunk));
    const pkt = Native.encodeText(s, i, total, new Uint8Array(part));
    await Native.advertise(mask(pkt));
    await new Promise(r=>setTimeout(r, 200));
  }
  setTimeout(()=>{ Native.stopAdvertise().catch(()=>{}); }, 2000);
}

export async function broadcastTeamLocation(){
  try{
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status!=="granted") {return;}
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const batt = await Battery.getBatteryLevelAsync().catch(()=>null);
    const obj = { lat: fix.coords.latitude, lon: fix.coords.longitude, acc: fix.coords.accuracy, batt: batt!=null? Math.round(batt*100) : undefined, ts: Date.now() };
    const blob = Buffer.from(JSON.stringify(obj), "utf8");
    const enc = encryptText(blob); // group key
    // Frame 0x04: ver=1,type=0x04,payload=enc
    const pkt = Native.packLoc2(new Uint8Array(enc));
    await Native.advertise(mask(pkt));
    await new Promise(r=>setTimeout(r, 800));
    await Native.stopAdvertise();
  }catch{}
}
