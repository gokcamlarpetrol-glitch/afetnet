import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { quantizeLatLng } from '../geo/coarse';
import { getDeviceShortId } from '../p2p/bleCourier';

const DIR = '/tmp/';
const FILE = DIR + 'sonar.pings.json';

let timer: any = null;

function sine19k(durationMs=120){
  // 44.1kHz mono 16-bit PCM WAV data URI
  const sr = 44100;
  const samples = Math.floor(sr*durationMs/1000);
  const buf = new Uint8Array(44 + samples*2);
  const dv = new DataView(buf.buffer);

  function wrStr(off:number, s:string){ for(let i=0;i<s.length;i++) {dv.setUint8(off+i, s.charCodeAt(i));} }
  function wr32(o:number, v:number){ dv.setUint32(o, v, true); }
  function wr16(o:number, v:number){ dv.setUint16(o, v, true); }

  // WAV header
  wrStr(0,'RIFF'); wr32(4, 36+samples*2); wrStr(8,'WAVE');
  wrStr(12,'fmt '); wr32(16,16); wr16(20,1); wr16(22,1); wr32(24,sr); wr32(28,sr*2); wr16(32,2); wr16(34,16);
  wrStr(36,'data'); wr32(40, samples*2);
  const f=19000; // 19 kHz
  for(let i=0;i<samples;i++){
    const t = i/sr; const s = Math.sin(2*Math.PI*f*t);
    dv.setInt16(44+i*2, Math.max(-32767, Math.min(32767, Math.floor(s*8000))), true);
  }
  const b64 = (globalThis as any).Buffer.from(buf).toString('base64');
  return 'data:audio/wav;base64,'+b64;
}

async function appendLog(rec:any){
  try{
    const ex = await FileSystem.getInfoAsync(FILE);
    const arr = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(FILE)) : [];
    arr.push(rec);
    const cutoff = Date.now() - 24*3600*1000;
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr.filter((r:any)=>r.ts>=cutoff)));
  }catch{
    // Ignore file write errors
  }
}

export async function startPing(){
  if(timer) {return;}
  const short = await getDeviceShortId?.() || 'me';
  const slot = Math.abs(hash(short)) % 10;
  async function cycle(){
    const now = new Date();
    if(now.getSeconds() % 10 === slot){
      const { sound } = await Audio.Sound.createAsync({ uri: sine19k(140) }, { shouldPlay: true, volume: 1.0 });
      try{
        const loc = await Location.getLastKnownPositionAsync({}); let q:any={};
        if(loc){ const c = quantizeLatLng(loc.coords.latitude, loc.coords.longitude); q={ qlat:c.lat, qlng:c.lng }; }
        await appendLog({ id: short, slot, ts: Date.now(), kind:'tx', strength: 1, ...q });
      }finally{
        (globalThis as any).setTimeout(()=>sound.unloadAsync().catch(()=>{
          // Ignore unload errors
        }), 300);
      }
    }
  }
  timer = (globalThis as any).setInterval(cycle, 300);
}

export function stopPing(){ if(timer){ (globalThis as any).clearInterval(timer); timer=null; } }

function hash(s:string){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return h; }



