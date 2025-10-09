import { listBeacons, upsertBeacon } from "./store";
import { Beacon } from "./model";
import { p2pLocalSend } from "../p2p/send"; // Phase 37's local P2P enqueue
import { quantizeLatLng } from "../geo/coarse";
import * as FileSystem from "expo-file-system";
import { useProfile } from "../state/profileStore";
import { paramsFor } from "../profile/params";

let timer: any = null;

async function enrich(b: Beacon){
  try{
    const loc = await (globalThis as any).getLastLocation?.();
    if(loc && typeof loc.latitude==="number" && typeof loc.longitude==="number"){
      const q = quantizeLatLng(loc.latitude, loc.longitude);
      b.qlat = q.lat; b.qlng = q.lng;
    }
  }catch{}
  return b;
}

async function tick(){
  const duty = paramsFor(useProfile.getState().profile);
  const now = Date.now();
  const items = await listBeacons(now);
  for(const b of items){
    const repeat = Math.max(b.repeatSec, duty.beaconRepeatSec);
    const due = !b.lastSent || (now - b.lastSent) >= (repeat*1000);
    if(!due) {continue;}
    const payload = {
      kind: b.kind,
      msg: b.msg,
      qlat: b.qlat,
      qlng: b.qlng,
      ts: now,
      src: "beacon"
    };
    await p2pLocalSend(payload);   // append to P2P outbox for offline dissemination
    b.lastSent = now;
    await upsertBeacon(b);
  }
}

export function startBeaconLoop(intervalMs = 15000){
  if(timer) {return;}
  timer = setInterval(tick, intervalMs);
}

export function stopBeaconLoop(){
  if(timer){ clearInterval(timer); timer = null; }
}

export async function createBeacon(b: Beacon){
  await enrich(b);
  await upsertBeacon(b);
}

export async function cancelBeacon(id: string){
  const now = Date.now();
  const items = await listBeacons(now);
  const keep = items.filter(x => x.id !== id);
  // rewrite
  await FileSystem.writeAsStringAsync("/tmp/beacons.json", JSON.stringify({items: keep}));
}
