import * as FileSystem from 'expo-file-system';
import { Task } from './types';

const FILE = '/tmp/tasks.jsonl';

export async function addTask(t: Task){ 
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(t)+'\n');
}
export async function listTasks(limit=200): Promise<Task[]>{ 
  const ex=await FileSystem.getInfoAsync(FILE); 
  if(!ex.exists) {return [];} 
  const txt=await FileSystem.readAsStringAsync(FILE); 
  return txt.split('\n').filter(Boolean).slice(-limit).map(x=>{try{return JSON.parse(x);}catch{return null;}}).filter(Boolean) as Task[]; 
}
export async function updateTask(id:string, patch: Partial<Task>){
  const arr = await listTasks(500);
  const out = arr.map(x=> x.id===id? { ...x, ...patch, updated: Date.now() } : x);
  await FileSystem.writeAsStringAsync(FILE, out.map(x=>JSON.stringify(x)).join('\n'));
}



