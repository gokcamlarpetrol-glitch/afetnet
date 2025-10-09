import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let on = false;

function makeBuffer(sampleRate=44100){
  // Generate SOS pattern: 1.8kHz tone in bursts (· · · – – – · · ·)
  const toneHz = 1800;
  const unit = 0.12; // 120ms dot
  const dash = unit*3;
  const gap = unit;      // between same-group signals
  const partGap = unit*3;// between dot and dash groups
  const seq = [unit, gap, unit, gap, unit, partGap, dash, gap, dash, gap, dash, partGap, unit, gap, unit, gap, unit];

  // Build PCM mono float32 [-1,1]
  const sr = sampleRate;
  const totalSec = seq.reduce((a,b)=>a+b,0) + 1.0; // +1s tail
  const N = Math.floor(totalSec*sr);
  const buf = new Float32Array(N);
  let t = 0;
  const w = 2*Math.PI*toneHz/sr;
  let cursor = 0;
  for (const seg of seq){
    const len = Math.floor(seg*sr);
    for (let i=0;i<len;i++){
      const s = Math.sin(w*t);
      buf[cursor++] = s*0.45; // amplitude
      t++;
    }
    // small silence between segments already encoded as gaps
  }
  // tail silence
  while (cursor<N) {buf[cursor++]=0;}
  return buf;
}

export async function startAudioBeacon(){
  if (on) {return;}
  on = true;
  const { sound: s } = await Audio.Sound.createAsync(
    { 
      // We'll feed a generated buffer via `createAsync` using an in-memory file approach in Expo is limited.
      // Workaround: use looped synthetic 'tone' asset from dataURI.
      uri: "data:audio/wav;base64," + await makeWavBase64() 
    },
    { isLooping: true, volume: 1.0, shouldPlay: true }
  );
  sound = s;
  try { await s.playAsync(); } catch {}
}

export async function stopAudioBeacon(){
  on = false;
  try { await sound?.stopAsync(); } catch {}
  try { await sound?.unloadAsync(); } catch {}
  sound = null;
}

export function isAudioBeaconOn(){ return on; }

// Minimal WAV writer for Float32 mono
async function makeWavBase64(){
  const pcm = makeBuffer();
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = 1 * bytesPerSample;
  const byteRate = 44100 * blockAlign;
  const dataLen = pcm.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  function W(off:number, s:string){ for(let i=0;i<s.length;i++) {v.setUint8(off+i, s.charCodeAt(i));} }
  let o=0;
  W(o,"RIFF"); o+=4;
  v.setUint32(o, 36 + dataLen, true); o+=4;
  W(o,"WAVE"); o+=4;
  W(o,"fmt "); o+=4;
  v.setUint32(o,16,true); o+=4;
  v.setUint16(o,1,true); o+=2; // PCM
  v.setUint16(o,1,true); o+=2; // mono
  v.setUint32(o,44100,true); o+=4;
  v.setUint32(o,byteRate,true); o+=4;
  v.setUint16(o,blockAlign,true); o+=2;
  v.setUint16(o,16,true); o+=2; // bits/sample
  W(o,"data"); o+=4;
  v.setUint32(o,dataLen,true); o+=4;
  // write samples
  let k=o;
  for (let i=0;i<pcm.length;i++){
    const s = Math.max(-1, Math.min(1, pcm[i]));
    const q = s<0 ? s*0x8000 : s*0x7fff;
    v.setInt16(k, q|0, true);
    k+=2;
  }
  // to base64
  const u8 = new Uint8Array(buf);
  let b64=""; const CHUNK=0x8000;
  for (let i=0;i<u8.length;i+=CHUNK){ b64 += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i+CHUNK))); }
  return b64toa(b64);
}

// Simple base64 from binary string
function b64toa(bin:string){ if (typeof btoa!=="undefined") {return btoa(bin);} /* RN polyfill */ 
  // @ts-ignore
  return Buffer.from(bin, "binary").toString("base64");
}



