import { LinkMux } from './link';
import { BleLink } from './bleLink';
import { WfdLink } from './wfd';
import { LoRaLink } from './lora';
import { unwrap } from './frame';
import { p2pLocalSend } from '../p2p/send';

let mux: LinkMux | null = null;

export async function startBridge(roomId='AFN_DEFAULT'){
  if(mux) {return mux;}
  mux = new LinkMux();
  mux.add(new LoRaLink());
  mux.add(new WfdLink(roomId));
  mux.add(new BleLink());

  mux.onMessage(async(bytes)=>{
    const f = unwrap(bytes); if(!f) {return;}
    try{
      const payload = JSON.parse((globalThis as any).Buffer.from(f.payloadB64,'base64').toString());
      // route into existing side-channel pipeline
      await p2pLocalSend(payload);
    }catch{
      // Ignore errors
    }
  });

  await mux.upAll();
  return mux;
}

export async function stopBridge(){ await mux?.downAll(); mux=null; }
export function bridgeMetrics(){ return mux?.metrics() || []; }
export async function bridgeSend(bytes:Uint8Array, critical=false){ return mux?.send(bytes, { critical }) ?? false; }



