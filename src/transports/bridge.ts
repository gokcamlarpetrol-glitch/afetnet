import { LinkMux } from './link';
import { BleLink } from './bleLink';
import { WfdLink } from './wfd';
import { LoRaLink } from './lora';
import { unwrap } from './frame';
import { p2pLocalSend } from '../p2p/send';
import { earthquakeWarningService } from '../services/EarthquakeWarningService';
import { logger } from '../utils/productionLogger';

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
      
      // Special handling for earthquake warnings via BLE relay
      if(payload.type === 'earthquake_warning'){
        logger.warn('📡 Received earthquake warning via BLE relay');
        // Trigger warning on this device
        await earthquakeWarningService.handleWarning?.(payload);
        return; // Don't route to normal pipeline
      }
      
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

/**
 * Relay earthquake warning to nearby devices via BLE
 * This ensures warnings reach users even when they're offline
 */
export async function relayEarthquakeWarning(warningData: any){
  try{
    const payload = {
      type: 'earthquake_warning',
      data: warningData,
      timestamp: Date.now(),
      critical: true,
    };
    
    const encoded = (globalThis as any).Buffer.from(JSON.stringify(payload)).toString('base64');
    const bytes = new Uint8Array((globalThis as any).Buffer.from(encoded, 'base64'));
    
    // Send with high priority
    await bridgeSend(bytes, true);
    logger.info('📡 Earthquake warning relayed via BLE');
  }catch(error){
    logger.error('❌ Failed to relay earthquake warning:', error);
  }
}



