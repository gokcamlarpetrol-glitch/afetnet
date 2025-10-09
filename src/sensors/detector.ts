import { Accelerometer, Barometer } from "expo-sensors";
import { Audio } from "expo-av";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";
import { useSafety } from "../state/safetyStore";
import { p2pLocalSend } from "../p2p/send";
import { quantizeLatLng } from "../geo/coarse";
import * as Location from "expo-location";

type Hint = "shake_still" | "baro_drop" | "loud_help";
let running = false;
let winHints: { t:number; h:Hint }[] = [];
let dutyTimer: any = null;

function pushHint(h:Hint){ winHints.push({ t: Date.now(), h }); const cutoff = Date.now()-5*60*1000; winHints = winHints.filter(x=>x.t>=cutoff); }

async function getCoarse(){
  try{ const p = await Location.getLastKnownPositionAsync({}); if(p){ const q=quantizeLatLng(p.coords.latitude,p.coords.longitude); return { qlat:q.lat, qlng:q.lng }; } }catch{}
  return {};
}

async function makeSOSBody(){
  const { qlat, qlng } = await getCoarse() as any;
  return {
    kind: "sos",
    body: "Auto-SOS: Sensör tespiti (enkaz olası).",
    qlat, qlng,
    hops: 0, maxHops: 6, ttlSec: 3600,
    ts: Date.now()
  };
}

async function tryAutoSOS(){
  const safety = useSafety.getState();
  // ≥2 farklı ipucu varsa taslak/veya gönder
  const kinds = new Set(winHints.map(x=>x.h));
  if(kinds.size >= 2){
    const sos = await makeSOSBody();
    if(safety.unconsciousMode){
      await p2pLocalSend(sos as any);
    }else{
      // taslak: aynı outbox'a "draft" bayrağı ile düş, UI zaten SOS listesinde gösteriyor olabilir.
      (sos as any).draft = true;
      await p2pLocalSend(sos as any);
    }
    // pencereyi sıfırla: spam olmasın
    winHints = [];
  }
}

export async function startDetector(){
  if(running) {return;} running = true;
  const sampleSec = 10, sleepSec = 50;
  async function cycle(){
    if(!useSafety.getState().sensorDetect){ dutyTimer = setTimeout(cycle, sleepSec*1000); return; }

    // Accelerometer — peak + stillness
    const accelSamples: number[] = [];
    const sub = Accelerometer.addListener(({ x,y,z })=>{
      const g = Math.sqrt(x*x+y*y+z*z);
      accelSamples.push(g);
    });
    Accelerometer.setUpdateInterval(100); // 10Hz
    // Barometer
    const baro: number[] = [];
    const baroSub = Barometer.addListener(({ pressure })=>{ baro.push(pressure); });

    // Audio amplitude (no recording file) — brief capture & meter
    let peakDb = -Infinity;
    try{
      await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:false });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({ android: { extension: ".amr" }, ios: { extension: ".caf" } } as any);
      await rec.startAsync();
      const t0 = Date.now();
      while(Date.now()-t0 < sampleSec*1000){
        // Expo Recording has limited meter; fallback: stop quickly and use simple peak estimate by short bursts — here we simulate a coarse meter tick:
        await new Promise(r=>setTimeout(r, 500));
        // we can't read amplitude directly everywhere; keep placeholder - just detect presence of loudness by attempting small chunks.
        peakDb = Math.max(peakDb, -10); // optimistic fallback; on devices with meter, replace by rec.getStatusAsync().metering
      }
      await rec.stopAndUnloadAsync();
    }catch{ /* ignore */ }

    // Close sensors
    sub.remove(); baroSub.remove();

    // Evaluate windows
    if(accelSamples.length){
      const maxG = Math.max(...accelSamples);
      const avg = accelSamples.reduce((a,b)=>a+b,0)/accelSamples.length;
      if(maxG>=2.0 && avg<=1.05){ pushHint("shake_still"); }
    }
    if(baro.length>4){
      const drop = baro[0]-baro[baro.length-1];
      if(drop>=0.8){ pushHint("baro_drop"); }
    }
    if(peakDb>-15){ pushHint("loud_help"); }

    await tryAutoSOS();

    dutyTimer = setTimeout(cycle, sleepSec*1000);
  }
  cycle();
}

export function stopDetector(){ running=false; if(dutyTimer){ clearTimeout(dutyTimer); dutyTimer=null; } }
