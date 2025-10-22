import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { setDutyCycle, setGroupPinCrypto, setGroupPin as setPinCrypto } from '../ble/bridge';
import { disableEPM, enableEPM } from '../power/epm';
import { SarConfig, start as startSAR, stop as stopSAR } from '../sar/runner';

const KEY='afn:cfg:v1';
export type OTA = {
  pin?: string;
  duty?: { scanMs?: number; pauseMs?: number };
  ttlMax?: number;            // reserved for future
  sar?: { sosEveryMs?: number; autoText?: string; enabled?: boolean };
  epm?: { enabled?: boolean };
};

export async function getConfig(): Promise<OTA>{
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveConfig(cfg: OTA){
  await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
}

export function validate(cfg: any){
  if (cfg==null || typeof cfg !== 'object') {return false;}
  if (cfg.pin && typeof cfg.pin !== 'string') {return false;}
  if (cfg.duty && (isNaN(cfg.duty.scanMs) || isNaN(cfg.duty.pauseMs))) {return false;}
  return true;
}

export async function applyConfig(cfg: OTA){
  if (cfg.pin){
    await setGroupPinCrypto(cfg.pin);
    setPinCrypto(cfg.pin);
  }
  if (cfg.duty){
    const s = Math.max(1000, Number(cfg.duty.scanMs ?? 6000));
    const p = Math.max(1000, Number(cfg.duty.pauseMs ?? 4000));
    setDutyCycle(s, p);
    await AsyncStorage.setItem('afn:duty:last', JSON.stringify({ scan: s, pause: p }));
  }
  if (cfg.epm){
    if (cfg.epm.enabled) {await enableEPM();} else {await disableEPM();}
  }
  if (cfg.sar){
    if (cfg.sar.enabled){
      const sc: SarConfig = {
        pin: cfg.pin || '',
        ttlMax: 2,
        scanMs: Number(cfg.duty?.scanMs ?? 6000),
        pauseMs: Number(cfg.duty?.pauseMs ?? 4000),
        sosEveryMs: Number(cfg.sar.sosEveryMs ?? 12000),
        autoText: cfg.sar.autoText,
      };
      await startSAR(sc);
    } else {
      stopSAR();
    }
  }
  await saveConfig(cfg);
}

export async function importFromFile(){
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', multiple: false });
  if (res.canceled || !res.assets?.length) {throw new Error('cancelled');}
  const uri = res.assets[0].uri;
  const json = await FileSystem.readAsStringAsync(uri);
  const cfg = JSON.parse(json);
  if (!validate(cfg)) {throw new Error('invalid config');}
  await applyConfig(cfg);
  return cfg;
}



