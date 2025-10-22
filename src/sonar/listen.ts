import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const DIR = '/tmp/';
const FILE = DIR + 'sonar.pings.json';

let listening=false;

type Det = { ts:number; slot:number; peak:number };

export async function startListen(){
  if(listening) {return;} listening=true;
  try{
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: false });
    const rec = new Audio.Recording();
    // enable metering (iOS)
    await (rec as any).prepareToRecordAsync({
      isMeteringEnabled: true,
      android: { extension: '.amr' },
      ios: { extension: '.caf', extensionHint: '.caf' },
    });
    await rec.startAsync();

    const loop = async()=>{
      if(!listening) { try{ await rec.stopAndUnloadAsync(); }catch{
        // Ignore stop errors
      } return; }
      const st:any = await rec.getStatusAsync();
      // metering: iOS -> st.metering is in dBFS
      if(st.metering !== undefined){
        const sec = (new Date()).getSeconds(); const slot = sec % 10;
        const peak = st.metering as number;
        if(peak > -20){ await appendDet({ ts: Date.now(), slot, peak }); }
      }
      (globalThis as any).setTimeout(loop, 200);
    };
    loop();
  }catch{
    // Android fallback: no metering available — we skip detection
    listening=false;
  }
}

export function stopListen(){ listening=false; }

async function appendDet(d: Det){
  try{
    const ex = await FileSystem.getInfoAsync(FILE);
    const arr = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(FILE)) : [];
    arr.push({ id:'unknown', slot:d.slot, ts:d.ts, kind:'rx', strength: 1 + Math.max(0, (d.peak+60)/40) });
    const cutoff = Date.now()-24*3600*1000;
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr.filter((r:any)=>r.ts>=cutoff)));
  }catch{
    // Ignore file write errors
  }
}



