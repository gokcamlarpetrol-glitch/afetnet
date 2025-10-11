import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { listBetween } from "../history/collector";

export async function exportGeoJSON(t0:number, t1:number){
  const pts = await listBetween(t0,t1);
  const gj = {
    type: "Feature",
    properties: { start: new Date(t0).toISOString(), end: new Date(t1).toISOString() },
    geometry: { type: "LineString", coordinates: pts.map(p=>[p.lon, p.lat]) }
  };
  const path = "/tmp/" + `trail_${t0}_${t1}.geojson`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(gj, null, 2), { encoding: "utf8" });
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(path, { mimeType:"application/geo+json", dialogTitle:"GeoJSON" });}
  return path;
}

export async function exportGPX(t0:number, t1:number){
  const pts = await listBetween(t0,t1);
  const head = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="AfetNet"><trk><name>Trail</name><trkseg>`;
  const tail = `</trkseg></trk></gpx>`;
  const body = pts.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.ts).toISOString()}</time></trkpt>`).join("");
  const xml = head + body + tail;
  const path = "/tmp/" + `trail_${t0}_${t1}.gpx`;
  await FileSystem.writeAsStringAsync(path, xml, { encoding: "utf8" });
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(path, { mimeType:"application/gpx+xml", dialogTitle:"GPX" });}
  return path;
}



