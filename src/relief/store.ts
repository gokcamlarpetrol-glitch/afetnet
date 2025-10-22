import * as FileSystem from 'expo-file-system';
import { Facility } from './types';

const FILE = '/tmp/facilities.json';
let mem: Facility[] | null = null;

export async function loadFacilities(): Promise<Facility[]>{
  if(mem) {return mem;}
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists){
    // seed minimal demo data (replace via datapack later)
    const seed: Facility[] = [
      { id:'s1', kind:'shelter', name:'Belediye Spor Salonu', lat:41.037, lng:28.985, capacity:800, open:'24/7', note:'Isıtma/çadır' },
      { id:'c1', kind:'clinic', name:'Sahra Kliniği - Park', lat:41.040, lng:28.990, capacity:200, open:'24/7', note:'İlk yardım' },
    ];
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(seed));
  }
  try{ mem = JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ mem = []; }
  return mem!;
}

export async function saveFacilities(arr: Facility[]){
  mem = arr; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr));
}

export function searchFacilities(arr: Facility[], q:string, kinds: Facility['kind'][]|null){
  const qq = (q||'').toLowerCase();
  return arr.filter(f=>{
    const m1 = !q || f.name.toLowerCase().includes(qq) || (f.note||'').toLowerCase().includes(qq);
    const m2 = !kinds || kinds.includes(f.kind);
    return m1 && m2;
  });
}



