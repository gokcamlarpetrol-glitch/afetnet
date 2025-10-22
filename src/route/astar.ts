import { Graph } from './types';
import { haversine } from '../geo/haversine';
import { HazardZone } from '../hazard/types';

function inCircle(p:{lat:number;lng:number}, z: HazardZone){
  const d = haversine(p, z.center);
  return d <= z.radius;
}
function zonePenalty(z: HazardZone){
  return z.severity===1 ? 0.25 : z.severity===2 ? 0.5 : 1.0;
}

export function routeAStar(g: Graph, startId:string, endId:string, hazards: HazardZone[]){
  const nodes = new Map(g.nodes.map(n=>[n.id, n]));
  const neigh = new Map<string, {to:string; w:number}[]>();
  for(const e of g.edges){
    const a = neigh.get(e.a)||[]; a.push({ to:e.b, w:e.w ?? haversine(nodes.get(e.a)!, nodes.get(e.b)!) }); neigh.set(e.a,a);
    const b = neigh.get(e.b)||[]; b.push({ to:e.a, w:e.w ?? haversine(nodes.get(e.a)!, nodes.get(e.b)!) }); neigh.set(e.b,b);
  }
  const penaltyAt = (id:string)=>{
    const p = nodes.get(id)!; let pen=0;
    for(const z of hazards){ if(inCircle({ lat:p.lat,lng:p.lng }, z)) {pen += zonePenalty(z);} }
    return pen;
  };
  const open = new Set<string>([startId]);
  const came = new Map<string,string>();
  const gScore = new Map<string,number>([[startId,0]]);
  const fScore = new Map<string,number>([[startId, haversine(nodes.get(startId)!, nodes.get(endId)!)]]);

  function best(){ let sel:string|undefined; let best=Infinity; for(const id of open){ const f=fScore.get(id) ?? Infinity; if(f<best){ best=f; sel=id; } } return sel; }

  while(open.size){
    const cur = best()!; if(cur===endId){
      const path=[cur]; let c=cur; while(came.has(c)){ c = came.get(c)!; path.unshift(c); }
      const dist = gScore.get(endId)??0;
      return { ok:true as const, path, dist };
    }
    open.delete(cur);
    const nbrs = neigh.get(cur)||[];
    for(const e of nbrs){
      const tentative = (gScore.get(cur)??Infinity) + e.w * (1 + penaltyAt(e.to));
      if(tentative < (gScore.get(e.to)??Infinity)){
        came.set(e.to, cur);
        gScore.set(e.to, tentative);
        fScore.set(e.to, tentative + haversine(nodes.get(e.to)!, nodes.get(endId)!));
        open.add(e.to);
      }
    }
  }
  return { ok:false as const };
}



