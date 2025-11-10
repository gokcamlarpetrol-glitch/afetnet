import * as FileSystem from 'expo-file-system';
import { Triage } from './types';
const DIR = '/tmp/';
const FILE = DIR + 'triage.json';
export async function listTriage(): Promise<Triage[]>{ const ex=await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];} try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ return []; } }
async function save(arr:Triage[]){ await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr)); }
export async function upsertTriage(t: Triage){ const arr=await listTriage(); const i=arr.findIndex(x=>x.id===t.id); if(i<0) {arr.push(t);} else {arr[i]=t;} await save(arr); return t; }



