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
  (globalThis as typeof globalThis).onerror = (msg: unknown, src?: string, line?: number, col?: number, err?: Error | unknown) => {
    push('ERR ' + String(msg||err));
    if (prevHandler) {
      try {
        prevHandler(msg as string | Event, src, line, col, err as Error);
      } catch {
        // Ignore errors
      }
    }
  };
  const prevRej = (globalThis as typeof globalThis).onunhandledrejection;
  (globalThis as typeof globalThis).onunhandledrejection = (ev: { reason?: unknown } | unknown) => {
    const reason = (ev && typeof ev === 'object' && 'reason' in ev) ? ev.reason : ev;
    push('PRJ ' + String(reason || ev));
    if (prevRej) {try{ prevRej.call(globalThis, ev); }catch{
      // Ignore errors
    }}
  };
}



