import * as FileSystem from 'expo-file-system';
const FILE = '/tmp/eew.last.json';
let mem:any=null;
export async function setLatestEEW(q:{id:string; mag:number; distKm?:number; when:number; src:'gateway'|'local'}){ mem=q; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(q)); }
export async function latestEEW(){ if(mem) {return mem;} try{ mem = JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{
  // Ignore file read errors
} return mem; }



