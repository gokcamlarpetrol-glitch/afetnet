import { p2pLocalSend } from '../p2p/send';
import { Task } from './types';
import { addTask, updateTask } from './taskStore';

export async function broadcastTask(t: Task){ await addTask(t); await p2pLocalSend({ kind:'task_new', v:1, t, ts: Date.now() }); }
export async function broadcastTaskPatch(id:string, patch: Partial<Task>){ await updateTask(id, patch); await p2pLocalSend({ kind:'task_patch', v:1, id, patch, ts: Date.now() }); }

export async function handleIncoming(msg:any){
  if(msg.kind==='task_new' && msg.t) {await addTask(msg.t as Task);}
  if(msg.kind==='task_patch' && msg.id && msg.patch) {await updateTask(msg.id as string, msg.patch as Partial<Task>);}
}



