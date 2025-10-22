import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { secretboxEncrypt, secretboxDecrypt } from '../crypto/backup';

const DIR = '/tmp/';
const OUT = DIR + 'backups/';

const INCLUDE = [
  'msg.inbox.jsonl','p2p.outbox.jsonl','board.json','logistics.json','hazards.json',
  'route.graph.json','e2ee.sessions.json','teams.json','approvals.json',
  'opslog/','afn_data/','mesh.health.json',
];

function listCandidates(){ return INCLUDE; }

export async function buildEncryptedZip(password:string){
  await FileSystem.makeDirectoryAsync(OUT, { intermediates:true }).catch(()=>{});
  const zip = new JSZip();
  for(const p of listCandidates()){
    const full = DIR + p;
    const ex = await FileSystem.getInfoAsync(full);
    if(!ex.exists) {continue;}
    if(ex.isDirectory){
      const files = await FileSystem.readDirectoryAsync(full);
      for(const f of files){
        const fd = full + f;
        const data = await FileSystem.readAsStringAsync(fd, { encoding: 'base64' });
        zip.file(p + f, data, { base64: true });
      }
    }else{
      const data = await FileSystem.readAsStringAsync(full, { encoding: 'base64' });
      zip.file(p, data, { base64: true });
    }
  }
  const plain = await zip.generateAsync({ type:'uint8array' });
  const enc = await secretboxEncrypt(plain, password);
  const blob = JSON.stringify(enc);
  const path = OUT + `afn_backup_${Date.now()}.zip.enc`;
  await FileSystem.writeAsStringAsync(path, (globalThis as any).Buffer.from(blob).toString('base64'));
  if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(path, { mimeType:'application/octet-stream', dialogTitle:'AfetNet Yedek' }); }
  return path;
}

export async function restoreEncryptedZip(fileUri:string, password:string){
  const b64 = await FileSystem.readAsStringAsync(fileUri);
  const obj = JSON.parse((globalThis as any).Buffer.from(b64,'base64').toString());
  const plain = await secretboxDecrypt(obj, password);
  const zip = await JSZip.loadAsync(plain);
  const entries = Object.keys(zip.files);
  for(const k of entries){
    const entry = zip.file(k);
    if(!entry) {continue;}
    const base64 = await entry.async('base64');
    const dst = DIR + k;
    await FileSystem.makeDirectoryAsync(dst.split('/').slice(0,-1).join('/'), { intermediates:true }).catch(()=>{});
    await FileSystem.writeAsStringAsync(dst, base64, { encoding: 'base64' });
  }
}
