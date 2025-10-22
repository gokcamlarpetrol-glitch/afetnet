import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAfetPackage } from './pack';
import { listTeams, listApprovals } from '../team/store';

export async function exportClosureBundle(tag='op'){
  // Reuse existing exporters + gather CAP docs + auto logs
  const base = await exportAfetPackage(); // returns {path, shared}
  const teams = await listTeams();
  const approvals = await listApprovals();

  // CAP docs
  const capDir = '/tmp/docs/cap/';
  const caps: unknown[] = [];
  try{
    const entries = await FileSystem.readDirectoryAsync(capDir);
    for (const f of entries){
      const p = capDir + f;
      const txt = await FileSystem.readAsStringAsync(p).catch(()=>null);
      if (txt) {caps.push(JSON.parse(txt));}
    }
  }catch{
    // Ignore directory read errors
  }

  // auto logs
  const logsDir = '/tmp/logs/auto/';
  const logs: {name:string, content:string}[] = [];
  try{
    const entries = await FileSystem.readDirectoryAsync(logsDir);
    for (const f of entries){
      const p = logsDir + f;
      const txt = await FileSystem.readAsStringAsync(p).catch(()=>null);
      if (txt) {logs.push({ name:f, content: txt });}
    }
  }catch{
    // Ignore directory read errors
  }

  const bundle = { generatedAt: new Date().toISOString(), tag, base, teams, approvals, caps, logs };
  const out = '/tmp/' + `ocb_${tag}_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(out, JSON.stringify(bundle, null, 2), { encoding: 'utf8' });
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(out, { mimeType:'application/json', dialogTitle:'Operasyon Özeti' });}
  return out;
}
