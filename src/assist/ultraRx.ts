/**
 * Ultrasonic listener: we don't have raw PCM in Expo across all devices, so we approximate with `Audio.Recording`.
 * We poll `metering` level (where supported). Fallback: sampling `getStatusAsync()`'s `metering`.
 */
import { Audio } from "expo-av";

let rec: Audio.Recording | null = null;
let on=false;
let cb:(lvl:number)=>void = ()=>{};

export async function startUltraRx(onLevel:(v:number)=>void){
  if (on) {return;} on=true; cb=onLevel;
  try{
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true });
    // start recording with metering if available
    // @ts-ignore
    rec = new Audio.Recording();
    // @ts-ignore
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    const t = setInterval(async ()=>{
      try{
        const st = await rec!.getStatusAsync();
        // @ts-ignore
        const m = (st.metering || 0); // -160..0 dB
        const lvl = Math.max(0, Math.min(1, 1 - Math.exp(-(m+160)/20)));
        cb(lvl);
      }catch{}
    }, 200);
    // @ts-ignore
    (rec as any).__timer = t;
  }catch{}
}
export async function stopUltraRx(){
  on=false;
  try{
    // @ts-ignore
    if ((rec as any)?.__timer) {clearInterval((rec as any).__timer);}
    await rec?.stopAndUnloadAsync();
  }catch{}
  rec=null;
}
export function isUltraRxOn(){ return on; }



