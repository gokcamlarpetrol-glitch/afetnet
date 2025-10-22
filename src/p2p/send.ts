import * as FileSystem from 'expo-file-system';
import { useRole } from '../state/roleStore';

const DIR = '/tmp/';
const OUTBOX = DIR + 'p2p.outbox.jsonl';

// Ensure local outbox append exists. If already present, keep as-is.
export async function p2pLocalSend(payload: any){
  const line = JSON.stringify({ v:1, ts: Date.now(), ...payload }) + '\n';
  const ex = await FileSystem.getInfoAsync(OUTBOX);
  const cur = ex.exists ? await FileSystem.readAsStringAsync(OUTBOX) : '';
  await FileSystem.writeAsStringAsync(OUTBOX+'.tmp', cur + line);
  await FileSystem.moveAsync({ from: OUTBOX+'.tmp', to: OUTBOX });
}

export async function p2pAnnounceRole(){
  const r = useRole.getState().role;
  await p2pLocalSend({ kind:'role_announce', v:1, ts: Date.now(), role: r });
}
