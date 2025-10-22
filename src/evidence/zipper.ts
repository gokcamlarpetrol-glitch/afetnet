import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { finalizePack, EV_DIR } from './store';
import { EvidencePack } from './types';
import { p2pLocalSend } from '../p2p/send';

export async function exportPack(pack: EvidencePack, autoShare=true){
  // ensure manifest finalized (hash set, manifest file present)
  const fin = await finalizePack(pack.id);
  const zip = new JSZip();
  const manifestPath = EV_DIR + `${pack.id}_manifest.json`;
  zip.file('manifest.json', await FileSystem.readAsStringAsync(manifestPath));
  for(const it of pack.items){
    if(it.t==='photo'){
      const b64 = await FileSystem.readAsStringAsync(it.path);
      zip.file(`photos/${it.ts}.jpg`, b64, { base64: true });
    }else if(it.t==='audio'){
      const b64 = await FileSystem.readAsStringAsync(it.path);
      zip.file(`audio/${it.ts}.m4a`, b64, { base64: true });
    }else if(it.t==='note'){
      zip.file(`notes/${it.ts}.txt`, it.text);
    }
  }
  const blob = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  const out = EV_DIR + `${pack.id}.zip`;
  await FileSystem.writeAsStringAsync(out, blob);

  // tiny P2P notice (reference only, no media)
  await p2pLocalSend({
    kind: 'evidence_notice',
    id: pack.id,
    ts: pack.ts,
    qlat: fin.qlat, qlng: fin.qlng,
    count: pack.items.length,
  });

  if(autoShare && await Sharing.isAvailableAsync()){
    await Sharing.shareAsync(out, { mimeType: 'application/zip', dialogTitle: 'Evidence ZIP' });
  }
  return out;
}
