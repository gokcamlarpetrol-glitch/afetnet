import * as FileSystem from 'expo-file-system';
import { Team, TeamMember, makeId } from './types';

const FILE = '/tmp/teams.json';
let mem: Team[] = [];

export async function loadTeams(){ try{ const ex=await FileSystem.getInfoAsync(FILE); mem = ex.exists? JSON.parse(await FileSystem.readAsStringAsync(FILE)) as Team[] : []; }catch{ mem=[]; } return mem; }
export async function saveTeams(arr:Team[]){ mem=arr; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr)); }

export async function upsertTeam(label:string, members:TeamMember[], id?:string){
  const arr = mem.length? mem : await loadTeams();
  if(id){
    const i = arr.findIndex(t=>t.id===id);
    if(i>=0) {arr[i] = { ...arr[i], label, members, updated: Date.now() };}
    else {arr.push({ id, label, members, updated: Date.now() });}
  }else{
    arr.push({ id: makeId('team'), label, members, updated: Date.now() });
  }
  await saveTeams(arr); return arr;
}



