export type WP = { id:string; lat:number; lng:number; label?: string; photoUri?: string };
export type Edge = { a:string; b:string; w?:number }; // w optional; default haversine
export type Graph = { nodes: WP[]; edges: Edge[]; ts:number };
