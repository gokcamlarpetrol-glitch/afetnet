import { encodeULB, decodeULB } from "./codec";
import { broadcastULB } from "./p2p";

export type FECFrame = { gid:string; idx:number; total:number; parity:boolean; payload:string };

export function fecSplit(text:string, N=3){
  // split into N chunks (last may be shorter), parity = XOR over char codes
  const chunks: string[] = [];
  const size = Math.ceil(text.length/N);
  for(let i=0;i<N;i++){ chunks.push(text.slice(i*size, (i+1)*size)); }
  const parity = xorStrings(chunks);
  return { chunks, parity };
}
function xorStrings(arr:string[]){
  // simple XOR over UTF-8 bytes
  const enc = arr.map(s=> new TextEncoder().encode(s));
  const max = Math.max(...enc.map(e=>e.length));
  const out = new Uint8Array(max);
  for(let i=0;i<max;i++){
    let v=0; for(const e of enc){ v ^= (e[i]||0); } out[i]=v;
  }
  return new TextDecoder().decode(out);
}

export async function fecBroadcast(text:string, N=3){
  const gid = "fec_"+Date.now().toString(36).slice(2,8);
  const { chunks, parity } = fecSplit(text, N);
  for(let i=0;i<chunks.length;i++){
    const enc = await encodeULB(JSON.stringify({ gid, idx:i, total:N, parity:false, payload: chunks[i] }));
    await broadcastULB(enc);
  }
  const encP = await encodeULB(JSON.stringify({ gid, idx:N, total:N, parity:true, payload: parity }));
  await broadcastULB(encP);
}

export function fecRecover(frames: FECFrame[]): string | null{
  // if total=N, we need N data chunks (0..N-1). If one missing and parity present → recover.
  const meta = frames[0]; if(!meta) {return null;} const N = meta.total;
  const datas = new Array<string|undefined>(N);
  let p:string|undefined;
  for(const f of frames){ if(f.parity) {p=f.payload;} else {datas[f.idx]=f.payload;} }
  const miss = datas.map((v,i)=> v? null: i).filter(v=>v!=null) as number[];
  if(miss.length===0){ return datas.join(""); }
  if(miss.length===1 && p){
    const rec = xorStrings( datas.map(s=> s||"") .concat([p]) ); // data XOR ... XOR parity = missing
    datas[miss[0]] = rec;
    return datas.join("");
  }
  return null;
}



