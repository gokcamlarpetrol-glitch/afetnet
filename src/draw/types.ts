export type DrawKind = 'rubble'|'flood'|'blocked'|'hazard'|'note';
export type DrawGeom = { lat:number; lng:number };
export type DrawShape = {
  id: string;
  kind: DrawKind;
  coords: DrawGeom[];        // polyline (polygon için ilk-ilk kapanır)
  ttlSec?: number;
  note?: string;
  color?: string;            // render önerisi
  ts: number;                // last update
  author?: string;
};



