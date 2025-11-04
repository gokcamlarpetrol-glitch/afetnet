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

let strobeActive = false;
let strobeTimeout: any = null;
export async function startMorseSOS(){
  // SOS pattern (· · · – – – · · ·)
  if (strobeActive) {return;}
  strobeActive = true;
  const unit = 120; // ms
  const seq = [1,1,1,3,3,3,1,1,1]; // dot=1, dash=3
  let i=0;

  const run = async (): Promise<void> => {
    if (!strobeActive) {return;}
    try{
      await SafeTorch.switchState(true);
      const seqIndex = seq[i % seq.length];
      if (seqIndex !== undefined) {
        await sleep(seqIndex * unit);
      }
      await SafeTorch.switchState(false);
      await sleep(unit);
      i++;
    }catch{
      // Ignore morse errors
    }

    if (!strobeActive) {return;}
    strobeTimeout = (globalThis as any).setTimeout(run, 0);
  };

  run();
}
export async function stopMorseSOS(){ 
  if (!strobeActive) {return;}
  strobeActive = false;
  if (strobeTimeout) {(globalThis as any).clearTimeout(strobeTimeout); strobeTimeout=null;}
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
