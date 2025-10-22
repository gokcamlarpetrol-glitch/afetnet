export type NodeId = string;
export type EdgeId = string;

export type RoadNode = { id: NodeId; lat: number; lng: number };
export type RoadEdge = {
  id: EdgeId;
  a: NodeId; b: NodeId;
  distM: number;           // metre
  kind?: 'primary'|'secondary'|'residential'|'service'|'track';
  oneway?: boolean;
};

export type RoadGraph = {
  nodes: Record<NodeId, RoadNode>;
  edges: Record<EdgeId, RoadEdge>;
  // adjacency (filled at load time)
  out?: Record<NodeId, EdgeId[]>;
};

export type Closure = {
  id: string;             // edgeId or synthetic
  edgeId: EdgeId;
  reason: 'rubble'|'flood'|'police'|'unknown';
  ts: number;
  ttlSec?: number;        // otomatik düşüş
  note?: string;
};

export type RoutePath = {
  id: string;
  from: { lat:number; lng:number };
  to:   { lat:number; lng:number };
  edges: EdgeId[];
  coords: { lat:number; lng:number }[];
  distM: number;
  riskCost: number;
  altIndex: 0|1|2;        // 0 ana, 1-2 alternatif
};

export type RiskFn = (lat:number, lng:number)=> number; // 0..1 arası ceza (MMI tabanlı)

export function haversineM(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  const R=6371000, toR=(x:number)=>x*Math.PI/180;
  const dLat=toR(b.lat-a.lat), dLng=toR(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}



