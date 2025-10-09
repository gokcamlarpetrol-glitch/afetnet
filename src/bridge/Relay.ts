import { AppState } from "react-native";
import getP2P from "../p2p/P2P.native";
import * as Beacon from "../ble/bridge";

/** When enabled, forward short P2P texts to BLE and consume BLE text to local P2P */
let enabled = false;

export function isEnabled(){ return enabled; }

export async function enable(){
  if (enabled) {return;}
  enabled = true;
  const p2p = getP2P();
  await p2p.start({
    onMessage: async (_from: any, text: string) => {
      if (!enabled) {return;}
      if (text.length <= 100) { await Beacon.broadcastText(text); }
    }
  } as any);
  await Beacon.start({ onNearby: (list)=>{ /* could inject to UI or map */ } });
  AppState.addEventListener("change", s => { /* optional throttling */ });
}

export async function disable(){
  enabled = false;
  await Beacon.stop();
  // Do not stop p2p here; let app manage
}
