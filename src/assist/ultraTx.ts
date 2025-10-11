import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let on = false;

function make19kWavBase64(){
  const sr = 44100, hz = 19000;
  const burstSec = 0.10; // 100 ms
  const silenceSec = 0.70;
  const totalSec = burstSec + silenceSec;
  const N = Math.floor(totalSec*sr);
  const buf = new Float32Array(N);
  let t=0, w=2*Math.PI*hz/sr;
  // burst
  for (let i=0;i<Math.floor(burstSec*sr);i++){ buf[i] = Math.sin(w*t)*0.35; t++; }
  // rest is silence
  // encode wav (16-bit PCM)
  const bytesPerSample=2, blockAlign=1*bytesPerSample, byteRate=sr*blockAlign;
  const dataLen = buf.length*bytesPerSample;
  const ab = new ArrayBuffer(44+dataLen); const v = new DataView(ab);
  const W=(o:number,s:string)=>{ for(let i=0;i<s.length;i++) {v.setUint8(o+i, s.charCodeAt(i));} };
  let o=0; W(o,"RIFF"); o+=4; v.setUint32(o,36+dataLen,true); o+=4; W(o,"WAVE"); o+=4;
  W(o,"fmt "); o+=4; v.setUint32(o,16,true); o+=4; v.setUint16(o,1,true); o+=2; v.setUint16(o,1,true); o+=2;
  v.setUint32(o,sr,true); o+=4; v.setUint32(o,byteRate,true); o+=4; v.setUint16(o,blockAlign,true); o+=2; v.setUint16(o,16,true); o+=2;
  W(o,"data"); o+=4; v.setUint32(o,dataLen,true); o+=4;
  let k=o;
  for(let i=0;i<buf.length;i++){ const bufValue = buf[i]; if (bufValue === undefined) continue; const s = Math.max(-1,Math.min(1,bufValue)); const q = s<0 ? s*0x8000 : s*0x7fff; v.setInt16(k,Math.round(q),true); k+=2; }
  const u8 = new Uint8Array(ab); let bin=""; const CH=0x8000;
  for (let i=0;i<u8.length;i+=CH){ bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i,i+CH))); }
  // @ts-ignore
  return (typeof btoa!=="undefined")? btoa(bin) : Buffer.from(bin,"binary").toString("base64");
}

export async function startUltraTx(){
  if (on) {return;} on=true;
  const b64 = make19kWavBase64();
  const { sound: s } = await Audio.Sound.createAsync({ uri: "data:audio/wav;base64,"+b64 }, { isLooping: true, volume: 1.0, shouldPlay: true });
  sound = s; try{ await s.playAsync(); }catch{}
}
export async function stopUltraTx(){ on=false; try{ await sound?.stopAsync(); }catch{} try{ await sound?.unloadAsync(); }catch{} sound=null; }
export function isUltraTxOn(){ return on; }



