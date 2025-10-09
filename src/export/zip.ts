import JSZip from "jszip";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { exportClosureBundle } from "./ocb";
import { listTeams, listApprovals } from "../team/store";
import { exportGeoJSON } from "./geo";

export async function exportZip(hours=2, tag="op"){
  const zip = new JSZip();
  // README
  const readme = [
    `AfetNet Archive`,
    `Generated: ${new Date().toISOString()}`,
    `App: ${Constants?.expoConfig?.name || "AfetNet"} (${Constants?.expoConfig?.version ?? ""})`,
    `Device: ${Device.modelName} • ${Device.osName} ${Device.osVersion}`,
    `Scope: last ${hours}h + OCB`
  ].join("\n");
  zip.file("README.txt", readme);

  // OCB
  const ocbPath = await exportClosureBundle(tag);
  zip.file("ocb.json", await FileSystem.readAsStringAsync(ocbPath));

  // GeoJSON trail
  const t1 = Date.now(), t0 = t1 - hours*3600*1000;
  const gjPath = await exportGeoJSON(t0, t1);
  zip.file("trail.geojson", await FileSystem.readAsStringAsync(gjPath));

  // Tasks
  const teams = await listTeams();
  const approvals = await listApprovals();
  zip.file("teams.json", JSON.stringify(teams, null, 2));
  zip.file("approvals.json", JSON.stringify(approvals, null, 2));

  // CAP docs
  const capDir = "/tmp/docs/cap/";
  try{
    const entries = await FileSystem.readDirectoryAsync(capDir);
    for (const f of entries){
      const p = capDir + f;
      zip.file("cap/"+f, await FileSystem.readAsStringAsync(p));
    }
  }catch{}

  // Auto logs
  const logsDir = "/tmp/logs/auto/";
  try{
    const entries = await FileSystem.readDirectoryAsync(logsDir);
    for (const f of entries){
      const p = logsDir + f;
      zip.file("logs/"+f, await FileSystem.readAsStringAsync(p));
    }
  }catch{}

  const blob = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
  const out = "/tmp/" + `afetnet_${tag}_${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(out, blob, { encoding: "utf8" as any });
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(out, { mimeType: "application/zip", dialogTitle: "AfetNet Arşiv" });}
  return out;
}
