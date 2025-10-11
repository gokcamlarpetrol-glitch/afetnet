import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { whisper } from "../family/whisper";
import { quantizeLatLng } from "../geo/coarse";
import { addTicket } from "../help/store";
import { now } from "../relief/util";
import { writeAudit } from "../safety/audit";

let rec: Audio.Recording | null = null;
let on=false;
let lastSOS=0;

// const BUF = 2048; // pseudo buffer len (we don't have PCM frames from expo, we use metering)
// const PEAK_TH = -20; // dBFS peak threshold (heuristic)
// const WHISTLE_MIN_HZ = 3000; // (placeholder: we can't FFT without PCM; use metering+duration heuristic)

export async function startAudioDetect(){
  if(on) {return;} on=true;
  try{
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS:true, staysActiveInBackground:false, playsInSilentModeIOS:true });
    rec = new Audio.Recording();
    await rec.prepareToRecordAsync({
      android: {
        extension: '.m4a',
        outputFormat: 'mpeg_4',
        audioEncoder: 'aac',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: 'mpeg4aac',
        audioQuality: 'high',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    } as any);
    await rec.startAsync();
    loop().catch(()=>{});
    writeAudit("system","audio.detect.start",{});
  }catch(e){ on=false; }
}

export async function stopAudioDetect(){
  on=false;
  try{ await rec?.stopAndUnloadAsync(); }catch{}
  rec=null;
  writeAudit("system","audio.detect.stop",{});
}

async function loop(){
  // NOTE: Expo Recording metering is limited; use time-slice approach: stop→read file→restart.
  while(on){
    await new Promise(r=>setTimeout(r, 4000));
    try{
      await rec?.stopAndUnloadAsync();
      const uri = rec?.getURI(); // we won't store; just inspect metadata size for heuristics
      // Heuristic: if filesize >> and short duration -> possible whistle/impact; we can't FFT here.
      if(uri){
        const info = await FileSystem.getInfoAsync(uri);
        // crude entropy/energy proxy
        const big = ((info as any).size||0) > 90000; // ~few seconds loud
        if(big){
          await triggerSOS("audio-energy");
        }
        await FileSystem.deleteAsync(uri, { idempotent:true });
      }
      rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 'mpeg_4',
          audioEncoder: 'aac',
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4aac',
          audioQuality: 'low',
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 64000,
        },
      } as any);
      await rec.startAsync();
    }catch{}
  }
}

async function triggerSOS(reason:string){
  const nowTs = Date.now();
  if(nowTs - lastSOS < 60_000) {return;} // debounce 60s
  lastSOS = nowTs;
  let q:{lat?:number;lng?:number}|undefined;
  try{ const p = await Location.getLastKnownPositionAsync({}); if(p){ q = quantizeLatLng(p.coords.latitude,p.coords.longitude); } }catch{}
  await addTicket({
    id: "h_sos_"+now(),
    ts: now(),
    kind: "rescue",
    title: "Ses Algılandı (Yardım Sinyali)",
    detail: "Enerji yüksek/keskin tepe — olası düdük/panlama",
    prio: "life",
    status: "new",
    qlat: q?.lat ?? 0, qlng: q?.lng ?? 0
  });
  await whisper("s o s ses yardim"); // ULB kısa
  await writeAudit("system","audio.detect.sos",{ reason, q });
}
