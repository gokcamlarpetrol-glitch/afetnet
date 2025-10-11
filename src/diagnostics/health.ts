import * as AV from "expo-av";
import { logger } from '../utils/productionLogger';
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Safe BLE manager to prevent crashes when native modules are not available
let BleManager: any = null;
let BleState: any = null;
let mgr: any = null;

try {
  const blePlx = require("react-native-ble-plx");
  BleManager = blePlx.BleManager;
  BleState = blePlx.State;
} catch (e) {
  logger.warn("react-native-ble-plx not available, using fallback");
}

function m(){ 
  if (!BleManager) {return null;}
  return (mgr ??= new BleManager()); 
}

export type Health = {
  ble: { state: string };
  mic: { granted: boolean };
  loc: { granted: boolean; lastFix?: string };
  battery: { level?: number; isLowPower?: boolean };
  device: { model: string | null; os: string; app: string; build: string | number | null };
  mbtiles: { server: boolean };
  p2p: { ios: boolean; android: boolean };
  lastSOS?: { lat: number; lon: number; ts: number } | null;
};

export async function getHealth(): Promise<Health>{
  // BLE
  const state = await m().state().catch(()=> "Unknown");
  // Mic
  const mic = await AV.Audio.getPermissionsAsync().catch(()=>({ granted:false }));
  // Loc
  const locPerm = await Location.getForegroundPermissionsAsync().catch(()=>({ status: "denied" as const }));
  let lastFix: string | undefined;
  try{
    if (locPerm.status === "granted"){
      const fix = await Location.getLastKnownPositionAsync();
      if (fix) {lastFix = new Date(fix.timestamp).toLocaleString();}
    }
  }catch{}
  // Battery
  let level: number | undefined; let isLowPower = false;
  try {
    const lvl = await Battery.getBatteryLevelAsync(); if (lvl!=null) {level = Math.round(lvl*100);}
    // expo-battery lowPowerMode?
    // @ts-ignore
    isLowPower = Boolean(Battery.isLowPowerModeEnabledAsync && await Battery.isLowPowerModeEnabledAsync());
  } catch {}
  // MBTiles server flag (simple file sentinel)
  const server = (globalThis as typeof globalThis).__afn_mbtiles_server__ === true;
  // P2P availability (adapters may set flags)
  const ios = Platform.OS === "ios";
  const android = Platform.OS === "android";
  // Last SOS
  let lastSOS: any = null;
  try{
    const raw = await FileSystem.readAsStringAsync("/tmp/last_sos.json");
    lastSOS = JSON.parse(raw);
  }catch{}
  return {
    ble: { state: String(state) },
    mic: { granted: Boolean(mic?.granted) },
    loc: { granted: locPerm.status === "granted", lastFix },
    battery: { level, isLowPower },
    device: { model: Device.modelName ?? null, os: `${Device.osName} ${Device.osVersion}`, app: Constants?.expoConfig?.name || "AfetNet", build: Constants?.nativeBuildVersion ?? Constants?.expoConfig?.version ?? null },
    mbtiles: { server },
    p2p: { ios, android },
    lastSOS
  };
}

export async function openBatterySettings(){
  if (Platform.OS !== "android") {return false;}
  try{
    // Open battery optimization settings (generic)
    await IntentLauncher.startActivityAsync("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
    return true;
  }catch{ return false; }
}
