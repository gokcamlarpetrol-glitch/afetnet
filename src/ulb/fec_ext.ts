import { encodeULB } from "./codec";
import { broadcastULB } from "./p2p";
import { fecSplit, FECFrame } from "./fec";

export async function fecBroadcastX(text:string, N=3, retries=1, interleaveMs=120){
  const gid = "fec_"+Date.now().toString(36).slice(2,8);
  const { chunks, parity } = fecSplit(text, N);
  const seq = [...chunks, parity]; // last is parity (idx=N)
  const total = N;

  // interleave order: 0,3,6,... then 1,4,7... then 2,5,8...
  function interleaveOrder(len:number, stride:number){
    const out:number[]=[]; for(let s=0;s<stride;s++){ for(let i=s;i<len;i+=stride){ out.push(i); } } return out;
  }
  const order = interleaveOrder(seq.length, 3);

  async function sendRound(missingIdx:number[]|null){
    for(const i of order){
      if(missingIdx && !missingIdx.includes(i)) {continue;} // only needed
      const isParity = (i===seq.length-1);
      const payload = isParity? seq[i] : seq[i];
      const body = JSON.stringify({ gid, idx: isParity? total : i, total, parity: isParity, payload });
      const enc = await encodeULB(body);
      await broadcastULB(enc);
      await new Promise(r=>setTimeout(r, interleaveMs));
    }
  }

  await sendRound(null);
  for(let r=0;r<retries;r++){
    // wait for NAK
    const wait = await new Promise<number[]>((resolve)=>{ 
      const t=setTimeout(()=>resolve([]), 1200);
      (global as typeof globalThis).__AFN_ULB_NAK__ = (gidIn:string, missing:number[])=>{ if(gidIn===gid){ clearTimeout(t); resolve(missing); } };
    });
    if(wait.length===0) {break;}
    await sendRound(wait);
  }
}



