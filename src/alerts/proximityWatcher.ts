import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { gridKey, haversineLatLng } from "../geo/proximity";
import { paramsFor } from "../profile/params";
import { useAlerts } from "../state/alertsStore";
import { useProfile } from "../state/profileStore";
import { sayKey } from "../voice/voice";

const DIR = "/tmp/";
const INBOX = DIR + "p2p.inbox.json";
let t:any=null;
const seen = new Map<string, number>(); // key -> lastTs

async function beep(){
  try{
    const p = paramsFor(useProfile.getState().profile);
    if(!p.audioEnabled) {return;}
    const { sound } = await Audio.Sound.createAsync(
      // simple short chirp (data URI 1kHz 120ms)
      { uri: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAZGF0YQwAAAAAAP8AAP//AAD//wAA//8AAP//AAAA" },
      { shouldPlay: true, volume: 1.0 }
    );
    await sound.playAsync(); setTimeout(()=>sound.unloadAsync().catch(()=>{}), 500);
  }catch{}
}

function shouldNotify(key:string, now:number){
  const last = seen.get(key) || 0;
  if(now - last < 120000) {return false;} // 2 dk debounce
  seen.set(key, now);
  return true;
}

export function startProximityWatcher(getLastLocation?:()=>Promise<{latitude:number;longitude:number}|null>){
  if(t) {return;}
  async function loop(){
    try{
      const alerts = useAlerts.getState();
      const prof = paramsFor(useProfile.getState().profile);
      if(!alerts.enableProximityAlerts) {return;}
      // read inbox once
      const ex = await FileSystem.getInfoAsync(INBOX);
      if(!ex.exists) {return;}
      const txt = await FileSystem.readAsStringAsync(INBOX);
      const data = JSON.parse(txt);
      const items = (data?.items ?? []) as any[];
      if(!items.length) {return;}
      // location
      const loc = await (getLastLocation?.() || (globalThis as any).getLastLocation?.());
      if(!loc) {return;}
      const me = { lat: loc.latitude, lng: loc.longitude };
      const now = Date.now();
      for(const it of items){
        const qlat = it?.payload?.qlat, qlng = it?.payload?.qlng;
        if(typeof qlat!=="number" || typeof qlng!=="number") {continue;}
        const d = haversineLatLng(me, { lat: qlat, lng: qlng });
        if(d <= alerts.proximityMeters){
          const k = it.id || gridKey(qlat, qlng) || String(qlat)+","+String(qlng);
          if(shouldNotify(k, now)){
            if(prof.hapticsEnabled){ Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{}); }
            await beep();
            await sayKey("alert_proximity", { meters: Math.round(d) });
          }
        }
      }
    }catch{ /* fail-soft */ }
    t = setTimeout(loop, paramsFor(useProfile.getState().profile).proximityPollMs) as any;
  }
  loop();
}

export function stopProximityWatcher(){ if(t){ clearTimeout(t); t=null; } }
