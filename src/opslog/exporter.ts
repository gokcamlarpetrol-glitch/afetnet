import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { collect, toCSV } from "./collector";

const DIR = "/tmp/";
const OUT = DIR + "opslog/";

export async function exportOpsLog(){
  const rows = await collect();
  const csv = toCSV(rows);
  const json = JSON.stringify(rows, null, 2);
  const zip = new JSZip();
  zip.file("opslog.csv", csv);
  zip.file("opslog.json", json);
  // include timechain if exists
  const tc = await FileSystem.getInfoAsync(DIR+"timechain.jsonl");
  if(tc.exists){ zip.file("timechain.jsonl", await FileSystem.readAsStringAsync(DIR+"timechain.jsonl")); }
  // include signatures (list only)
  try{
    const ev = await FileSystem.readDirectoryAsync(DIR+"evidence/");
    const sigs = ev.filter(f=>f.endsWith("_signature.json"));
    zip.file("evidence_signatures.txt", sigs.join("\n"));
  }catch{}
  const blob = await zip.generateAsync({ type:"base64", compression:"DEFLATE" });
  await FileSystem.makeDirectoryAsync(OUT, { intermediates:true }).catch(()=>{});
  const path = OUT + `ops_${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(path, blob);
  if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(path, { mimeType:"application/zip", dialogTitle:"Operasyon Günlüğü" }); }
  return path;
}
