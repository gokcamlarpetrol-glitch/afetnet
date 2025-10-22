import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import JSZip from 'jszip';

async function readIfExists(path: string) {
  try { return await FileSystem.readAsStringAsync(path); } catch { return null; }
}

export async function createBackup(pass?: string) {
  const zip = new JSZip();
  const doc = '/tmp/';
  const cand = ['ocb.json','trail.geojson','tasks.json'];
  for (const f of cand) {
    const p = doc + f;
    const s = await readIfExists(p);
    if (s) {zip.file(f, s);}
  }
  // pack
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  let out = `${doc}backup_${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(out, base64, { encoding: 'utf8' });

  if (pass && pass.length > 0) {
    // Hash-based envelope (placeholder, AES yoksa):
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64 + '|' + pass);
    const enc = `${out}.enc`;
    await FileSystem.writeAsStringAsync(enc, digest);
    out = enc;
  }
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(out, { mimeType: 'application/octet-stream' });}
  return out;
}
