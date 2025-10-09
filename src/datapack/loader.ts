import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { Facility } from "../relief/types";
import { saveFacilities } from "../relief/store";
import { saveGraph } from "../routing/store";
import { RoadGraph } from "../routing/types";

export type DataPackSummary = { facilities?: number; routes?: number; points?: number };

export async function pickAndLoadDataPack(): Promise<DataPackSummary>{
  const p = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if(p.canceled || !p.assets?.length) {return {};}
  const uri = p.assets[0].uri;
  // Expect plain JSON with sections; zip can be supported later by unzip lib
  const txt = await FileSystem.readAsStringAsync(uri);
  const j = JSON.parse(txt);
  const summary: DataPackSummary = {};
  if(Array.isArray(j.facilities)){ await saveFacilities(j.facilities as Facility[]); summary.facilities = j.facilities.length; }
  if(j.roads && j.roads.nodes && j.roads.edges){
    await saveGraph(j.roads as RoadGraph);
    summary.routes = Object.keys(j.roads.edges||{}).length;
  }
  // routes/points placeholders for future phases
  return summary;
}
