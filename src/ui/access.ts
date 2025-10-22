import * as FileSystem from 'expo-file-system';
const FILE = '/tmp/access.ui.json';
type Access = { large:boolean; high:boolean };
let mem:Access={ large:false, high:false };
export async function loadAccess(){ try{ mem=JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{
  // Ignore errors
} return mem; }
export async function setAccess(p:Partial<Access>){ mem={ ...mem,...p }; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(mem)); return mem; }
export function getAccess(){ return mem; }



