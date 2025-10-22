import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import JSZip from 'jszip';
import { DataPackManifest } from './types';
const DIR = '/tmp/';
const DATA_ROOT = DIR + 'afn_data/';
const APPLIED = DATA_ROOT + 'applied.json';
const BACKUP = DATA_ROOT + 'backup/';

async function ensure(){ await FileSystem.makeDirectoryAsync(DATA_ROOT, { intermediates: true }).catch(()=>{}); await FileSystem.makeDirectoryAsync(BACKUP, { intermediates: true }).catch(()=>{}); }

export async function listApplied(){ await ensure(); const ex = await FileSystem.getInfoAsync(APPLIED); if(!ex.exists) {return [];} try{ return JSON.parse(await FileSystem.readAsStringAsync(APPLIED)); }catch{ return []; } }
async function writeApplied(arr:any[]){ await FileSystem.writeAsStringAsync(APPLIED, JSON.stringify(arr, null, 2)); }

export async function verifyZip(buf:ArrayBuffer){
  const zip = await JSZip.loadAsync(buf);
  const manStr = await zip.file('manifest.json')?.async('string');
  const sigStr = await zip.file('signature.json')?.async('string');
  if(!manStr || !sigStr) {throw new Error('manifest/signature yok');}
  const sha = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, manStr);
  const sig = JSON.parse(sigStr);
  if(sig.sha256 !== sha) {throw new Error('manifest SHA uyumsuz');}
  return { zip, manifest: JSON.parse(manStr) as DataPackManifest, signature: sig };
}

export async function preview(manifest: DataPackManifest){
  return manifest.files.map(f=>({ path: DATA_ROOT + f.path, mode: f.mode }));
}

async function backupFile(dst:string){
  const ex = await FileSystem.getInfoAsync(dst);
  if(!ex.exists) {return null;}
  const bak = BACKUP + dst.split('/').slice(-1)[0] + '.' + Date.now() + '.bak';
  await FileSystem.copyAsync({ from: dst, to: bak });
  return bak;
}

export async function applyPack(zip: JSZip, manifest: DataPackManifest){
  await ensure();
  const touched: { path:string; backup?:string|null }[] = [];
  for(const f of manifest.files){
    const dst = DATA_ROOT + f.path;
    if(f.mode==='remove'){
      const b = await backupFile(dst);
      touched.push({ path: dst, backup: b });
      try{ await FileSystem.deleteAsync(dst, { idempotent:true }); }catch{
        // Ignore delete errors
      }
      continue;
    }
    // add/update
    const entry = zip.file('payload/'+f.path);
    if(!entry) {throw new Error('Eksik payload: '+f.path);}
    const base64 = await entry.async('base64');
    const b = await backupFile(dst);
    touched.push({ path: dst, backup: b });
    await FileSystem.makeDirectoryAsync(dst.split('/').slice(0,-1).join('/'), { intermediates: true }).catch(()=>{});
    await FileSystem.writeAsStringAsync(dst, base64);
  }
  const applied = await listApplied();
  applied.push({ packId: manifest.packId, version: manifest.version, ts: Date.now(), files: touched });
  await writeApplied(applied);
  return touched.length;
}

export async function rollbackLast(){
  const applied = await listApplied();
  const last = applied.pop();
  if(!last) {throw new Error('Kayıt yok');}
  for(const f of last.files){
    if(f.backup){ await FileSystem.copyAsync({ from: f.backup, to: f.path }); }
    else{ await FileSystem.deleteAsync(f.path, { idempotent:true }).catch(()=>{}); }
  }
  await writeApplied(applied);
}
