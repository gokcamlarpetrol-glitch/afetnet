import * as FileSystem from "expo-file-system";
const FILE = "/tmp/family.roles.json";

export type Role = "guardian"|"child"|"elder"|"special";
export type RoleEntry = { memberId:string; role: Role; note?:string };

let mem: RoleEntry[] = [];
export async function loadRoles(){ try{ mem = JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ mem=[]; } return mem; }
export async function saveRoles(arr:RoleEntry[]){ mem=arr; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr)); }
export function getRole(memberId:string){ return mem.find(x=>x.memberId===memberId); }



