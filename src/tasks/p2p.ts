import { Task } from "./types";
import { p2pLocalSend } from "../p2p/send";
export async function broadcastTask(t: Task){
  await p2pLocalSend({ kind: "task_notice", v:1, ts: Date.now(), task: t });
}



