import * as Beacon from "../ble/bridge";
import { sanitizeText, rateLimit } from "../lib/sanitize";
import { startForegroundNote, stopForegroundNote } from "../bg/service";
import { noteConfigConflict } from "../diag/autoLog";

let on = false;
let t: any = null;

export type SarConfig = {
  pin: string;
  ttlMax: number;
  scanMs: number;
  pauseMs: number;
  sosEveryMs: number; // auto SOS period
  autoText?: string; // optional repeating short broadcast
};

export function isOn(){ return on; }

export async function start(cfg: SarConfig){
  if (on) {return;}
  on = true;
  // apply crypto pin + duty cycle + relay
  await Beacon.setGroupPinCrypto(cfg.pin);
  Beacon.setGroupPin(cfg.pin);
  Beacon.setDutyCycle(cfg.scanMs, cfg.pauseMs);
  if (cfg.scanMs<2000 || cfg.pauseMs<1000) {noteConfigConflict(`SAR very aggressive duty: scan=${cfg.scanMs}, pause=${cfg.pauseMs}`);}
  Beacon.setRelayMode(true);
  // auto loop
  await startForegroundNote();
  t = setInterval(async ()=>{
    if (!rateLimit(500)) {return;}
    try{
      await Beacon.broadcastSOS(()=>50);
      if (cfg.autoText) {await Beacon.broadcastText(sanitizeText(cfg.autoText));}
    }catch{}
  }, Math.max(cfg.sosEveryMs, 5000));
}

export function stop(){
  on = false;
  if (t) {clearInterval(t), t=null;}
  Beacon.setRelayMode(false);
  stopForegroundNote().catch(()=>{});
}
