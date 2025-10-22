import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CapLite, validate } from './schema';
import { wrapCap } from './edxlenv';

export async function saveCap(cap: CapLite){
  if (!validate(cap)) {throw new Error('CAP formu eksik');}
  const env = wrapCap(cap);
  const dir = '/tmp/docs/cap/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(()=>{});
  const path = dir + cap.identifier + '.json';
  await FileSystem.writeAsStringAsync(path, JSON.stringify(env, null, 2), { encoding: 'utf8' });
  return path;
}

export async function shareCap(path:string){
  const can = await Sharing.isAvailableAsync();
  if (!can) {return false;}
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'CAP Paketi' });
  return true;
}



