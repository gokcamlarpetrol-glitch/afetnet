import * as FileSystem from "expo-file-system";

export type PowerProfile = {
  meshPingSec: number;     // convoy ping / mesh beacon aralığı
  audioDetect: boolean;    // dinleme açık/kapalı
  ulbRateLimitSec: number; // ULB gönderim min aralık
  screenDimming: boolean;  // otomatik ekran kıs
};
const FILE = "/tmp/power.profile.json";
let mem: PowerProfile = { meshPingSec:30, audioDetect:false, ulbRateLimitSec:10, screenDimming:true };

export async function loadPower(){ try{ mem = JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{} return mem; }
export async function savePower(p:Partial<PowerProfile>){ mem = { ...mem, ...p }; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(mem)); return mem; }
export function getPower(){ return mem; }



