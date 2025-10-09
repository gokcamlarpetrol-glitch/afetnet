import * as FileSystem from "expo-file-system";
const FILE = "/tmp/risk.settings.json";
let mem = { stepDeg: 0.2 };
export async function loadRiskSettings(){ try{ const j=JSON.parse(await FileSystem.readAsStringAsync(FILE)); mem=j; }catch{} return mem; }
export async function saveRiskSettings(s:Partial<typeof mem>){ mem={...mem,...s}; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(mem)); }
export function getStepDeg(){ return mem.stepDeg; }



