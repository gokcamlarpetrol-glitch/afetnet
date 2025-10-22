import * as FileSystem from 'expo-file-system';

/** Read specific chunk (0-based) */
export async function readChunk(path:string, offset:number, size:number){
  const b = await FileSystem.readAsStringAsync(path, { encoding: 'base64', position: offset, length: size } as any);
  return b; // base64
}
export async function appendChunk(path:string, b64:string){
  // append; ensure file exists
  const ex = await FileSystem.getInfoAsync(path);
  if(!ex.exists){ await FileSystem.writeAsStringAsync(path, '', { encoding: 'base64' }); }
  const existing = await FileSystem.readAsStringAsync(path, { encoding: 'base64' }).catch(()=>'');
  await FileSystem.writeAsStringAsync(path, existing + b64, { encoding: 'base64' });
}
