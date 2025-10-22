import { SafeTorch } from './SafeTorch';
// Platform import removed as it's not used

let on = false;
export async function torchOn(){ 
  try{ 
    await SafeTorch.switchState(true); 
    on=true; 
  }catch{
    // Ignore torch errors
  }
}
export async function torchOff(){ 
  try{ 
    await SafeTorch.switchState(false); 
    on=false; 
  }catch{
    // Ignore torch errors
  }
}
export function isTorchOn(){ return on; }

let strobeT:any=null;
export async function startMorseSOS(){
  // SOS pattern (· · · – – – · · ·)
  if (strobeT) {return;}
  const unit = 120; // ms
  const seq = [1,1,1,3,3,3,1,1,1]; // dot=1, dash=3
  let i=0;
  strobeT = (globalThis as any).setInterval(async ()=>{
    try{
      // on
      await SafeTorch.switchState(true);
      const seqIndex = seq[i % seq.length];
      if (seqIndex !== undefined) {
        await sleep(seqIndex * unit);
      }
      // off
      await SafeTorch.switchState(false);
      await sleep(unit);
      i++;
    }catch{
      // Ignore morse errors
    }
  }, 10);
}
export async function stopMorseSOS(){ 
  if (strobeT) {(globalThis as any).clearInterval(strobeT);} 
  strobeT=null; 
  try{ 
    await SafeTorch.switchState(false); 
  }catch{
    // Ignore torch errors
  }
}

let screenT:any=null;
 
export function startScreenStrobe(cb:(v:boolean)=>void){
  if (screenT) {return;}
  // ~7Hz default
  screenT = (globalThis as any).setInterval(()=>{
    cb(true);
    (globalThis as any).setTimeout(()=>cb(false), 70);
  }, 140);
}
 
export function stopScreenStrobe(cb?:(v:boolean)=>void){
  if (screenT){ (globalThis as any).clearInterval(screenT); screenT=null; }
  if (cb) {cb(false);}
}
function sleep(ms:number){ return new Promise(r=>(globalThis as any).setTimeout(r,ms)); }
