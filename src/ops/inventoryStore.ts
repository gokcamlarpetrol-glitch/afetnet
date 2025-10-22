import * as FileSystem from 'expo-file-system';
import { InvItem, makeId } from './types';

const FILE = '/tmp/inventory.json';
let mem: InvItem[] = [];

export async function loadInventory(): Promise<InvItem[]>{
  try{
    const ex = await FileSystem.getInfoAsync(FILE);
    mem = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(FILE)) as InvItem[] : [];
  }catch{ mem = []; }
  return mem;
}
export async function saveInventory(arr: InvItem[]){ mem = arr; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr)); }
export async function upsertItem(partial: Omit<InvItem,'id'|'updated'> & { id?:string }){
  const arr = mem.length? mem : await loadInventory();
  if(partial.id){
    const i = arr.findIndex(x=>x.id===partial.id);
    if(i>=0){ arr[i] = { ...arr[i], ...partial, updated: Date.now() }; }
    else { arr.push({ ...(partial as any), id: partial.id, updated: Date.now() }); }
  }else{
    arr.push({ ...(partial as any), id: makeId('inv'), updated: Date.now() });
  }
  await saveInventory(arr); return arr;
}



