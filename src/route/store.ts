import * as FileSystem from 'expo-file-system';
// import * as ImagePicker from "expo-image-picker"; // Not available
import { Graph } from './types';

const DIR = '/tmp/';
const FILE = DIR + 'route.graph.json';

export async function loadGraph(): Promise<Graph>{
  const ex = await FileSystem.getInfoAsync(FILE);
  if(!ex.exists) {return { nodes:[], edges:[], ts: Date.now() };}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{ return { nodes:[], edges:[], ts:Date.now() }; }
}
async function save(g: Graph){ g.ts = Date.now(); await FileSystem.writeAsStringAsync(FILE, JSON.stringify(g)); }

export async function addNode(p:{lat:number;lng:number}){
  const g = await loadGraph();
  const id = 'wp_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  g.nodes.push({ id, lat:p.lat, lng:p.lng });
  await save(g); return id;
}
export async function addEdge(a:string, b:string, w?:number){
  const g = await loadGraph();
  if(!g.edges.find(e=> (e.a===a && e.b===b) || (e.a===b && e.b===a))){
    g.edges.push({ a, b, w });
    await save(g);
  }
}
export async function clearGraph(){ await save({ nodes:[], edges:[], ts:Date.now() }); }

export async function setNodeLabel(id:string, label:string){
  const g = await loadGraph();
  const n = g.nodes.find(x=>x.id===id); if(!n) {return;}
  n.label = label; await save(g);
}
export async function setNodePhoto(id:string, uri:string){
  const g = await loadGraph();
  const n = g.nodes.find(x=>x.id===id); if(!n) {return;}
  n.photoUri = uri; await save(g);
}
export async function pickPhotoFromCamera(): Promise<string|null>{
  // ImagePicker not available - would need expo-image-picker
  return null;
}
export async function pickPhotoFromGallery(): Promise<string|null>{
  // ImagePicker not available - would need expo-image-picker
  return null;
}
