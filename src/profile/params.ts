import { ResilienceProfile } from '../state/profileStore';

export type RuntimeParams = {
  bleScanMs: number;
  bleSleepMs: number;
  beaconRepeatSec: number;
  proximityPollMs: number;
  audioEnabled: boolean;
  hapticsEnabled: boolean;
};

export function paramsFor(p: ResilienceProfile): RuntimeParams {
  if(p==='low_power'){
    return {
      bleScanMs: 8000,         // daha kısa tarama
      bleSleepMs: 32000,       // daha uzun uyku
      beaconRepeatSec: 180,    // 3 dk
      proximityPollMs: 8000,   // seyrek kontrol
      audioEnabled: false,     // ses kapalı
      hapticsEnabled: true,
    };
  }
  if(p==='silent'){
    return {
      bleScanMs: 12000,
      bleSleepMs: 24000,
      beaconRepeatSec: 180,
      proximityPollMs: 8000,
      audioEnabled: false,     // tamamen sessiz
      hapticsEnabled: false,    // titreşim de kapalı
    };
  }
  // normal
  return {
    bleScanMs: 12000,
    bleSleepMs: 18000,
    beaconRepeatSec: 90,
    proximityPollMs: 5000,
    audioEnabled: true,
    hapticsEnabled: true,
  };
}



