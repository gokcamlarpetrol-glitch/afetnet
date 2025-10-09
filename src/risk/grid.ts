import * as FileSystem from "expo-file-system";
import { EEWAlert } from "../eew/types";
import { estimateETAAndMMI } from "../eew/estimate";
import { TR_BBOX } from "./const";

export type GridCell = { lat:number; lng:number; mmi:number; etaSec:number; pEtaSec:number };
export type GridBundle = { id:string; ts:number; src:EEWAlert["src"]; mag:number; depth?:number; epi:{lat:number;lng:number}; stepDeg:number; cells: GridCell[] };

const FILE = "/tmp/risk.grid.json";

export async function computeGrid(alert: EEWAlert, stepDeg=0.2): Promise<GridBundle>{
  const cells: GridCell[] = [];
  for(let lat=TR_BBOX.minLat; lat<=TR_BBOX.maxLat; lat+=stepDeg){
    for(let lng=TR_BBOX.minLng; lng<=TR_BBOX.maxLng; lng+=stepDeg){
      const est = estimateETAAndMMI({ lat: alert.lat, lng: alert.lng, depthKm: alert.depth||10 }, { lat, lng }, alert.mag);
      cells.push({ lat: +lat.toFixed(3), lng: +lng.toFixed(3), mmi:+est.mmi.toFixed(2), etaSec:+est.etaSec.toFixed(0), pEtaSec:+est.pEtaSec.toFixed(0) });
    }
  }
  return { id: alert.id, ts: alert.ts, src: alert.src, mag: alert.mag, depth: alert.depth, epi:{ lat:alert.lat, lng:alert.lng }, stepDeg, cells };
}

export async function saveGrid(g: GridBundle){
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(g));
}
export async function loadGrid(): Promise<GridBundle|null>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return null;}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)) as GridBundle; }catch{ return null; }
}



