import * as FileSystem from "expo-file-system";
import { Task } from "./types";

const DIR = "/tmp/";
const FILE = DIR + "tasks.json";

export async function listTasks(): Promise<Task[]>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ return []; }
}
async function save(list: Task[]){ await FileSystem.writeAsStringAsync(FILE, JSON.stringify(list)); }

export async function upsertTask(t: Task){
  const list = await listTasks();
  const i = list.findIndex(x=>x.id===t.id);
  if(i<0){ list.push(t); }
  else{
    if(t.rev <= list[i].rev) {return list[i];} // conflict ignore
    list[i] = t;
  }
  await save(list); return t;
}



