import { initQueue } from '../queue/v2';
export async function ensureQueueReady(){
  try{ await initQueue(); }catch{
    // Ignore queue initialization errors
  }
}



