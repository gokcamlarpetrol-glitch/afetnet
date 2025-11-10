import * as FileSystem from 'expo-file-system';

const PATH = '/tmp/logs/auto/';
const ring: string[] = [];
const CAP = 200;

function push(line:string){
  const ts = new Date().toISOString();
  ring.push(`[${ts}] ${line}`);
  if (ring.length>CAP) {ring.shift();}
}

export function note(line:string){ push(line); }
export function noteConfigConflict(line:string){ push('CFG ' + line); }
export function getRing(){ return ring.slice(); }

export async function flush(){
  await FileSystem.makeDirectoryAsync(PATH, { intermediates:true }).catch(()=>{});
  const p = PATH + `auto_${Date.now()}.txt`;
  await FileSystem.writeAsStringAsync(p, ring.join('\n'), { encoding: 'utf8' });
  return p;
}

// Hooks
export function installGlobal(){
  const prevHandler = (globalThis as typeof globalThis).onerror;
  (globalThis as typeof globalThis).onerror = (msg: any, src?: any, line?: any, col?: any, err?: any)=>{
    push('ERR ' + String(msg||err));
    if (prevHandler) {try{ prevHandler(msg,src,line,col,err); }catch{
      // Ignore errors
    }}
  };
  const prevRej = (globalThis as typeof globalThis).onunhandledrejection;
  (globalThis as typeof globalThis).onunhandledrejection = (ev:any)=>{
    push('PRJ ' + String(ev?.reason || ev));
    if (prevRej) {try{ prevRej.call(globalThis, ev); }catch{
      // Ignore errors
    }}
  };
}



