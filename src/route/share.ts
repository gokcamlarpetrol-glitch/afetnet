import * as FileSystem from 'expo-file-system';
import { Graph, WP } from './types';
import { loadGraph } from './store';

const DIR = '/tmp/';
const RECEIVED = DIR + 'routes.received.json';

export type SharedRoute = {
  v:1; type:'route_share'; id:string; ts:number;
  path: { lat:number; lng:number; label?:string }[];
  dist: number;
  note?: string;
};

export async function buildShareFromPath(pathIds:string[], dist:number, g?:Graph, note?:string): Promise<SharedRoute>{
  const G = g || await loadGraph();
  const find = (id:string)=> G.nodes.find(n=>n.id===id)!;
  const path = pathIds.map(id=>{ const n=find(id); return ({ lat:n.lat, lng:n.lng, label:n.label }); });
  return { v:1, type:'route_share', id: 'rs_'+Date.now().toString(36), ts: Date.now(), path, dist, note };
}

export async function listReceived(): Promise<SharedRoute[]>{
  const ex = await FileSystem.getInfoAsync(RECEIVED);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(RECEIVED)); }catch{ return []; }
}

export async function addReceived(sr: SharedRoute){
  const arr = await listReceived();
  arr.push(sr);
  await FileSystem.writeAsStringAsync(RECEIVED, JSON.stringify(arr));
}



