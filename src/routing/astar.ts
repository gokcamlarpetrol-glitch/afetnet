import { RoadGraph, RiskFn, RoutePath, haversineM } from './types';
import { listShapes } from '../draw/store';

type PQ<T> = { push:(item:T,pri:number)=>void; pop:()=>T|undefined; size:()=>number };
function makePQ<T>(): PQ<T>{
  const a: {i:T; p:number}[] = [];
  return {
    push(i,p){ a.push({ i,p }); a.sort((x,y)=> x.p-y.p); },
    pop(){ return a.shift()?.i; },
    size(){ return a.length; },
  };
}

export function nearestNode(g:RoadGraph, p:{lat:number;lng:number}){
  let best: any=null; let bestD=Number.POSITIVE_INFINITY;
  for(const n of Object.values(g.nodes)){
    const d = haversineM(p, { lat:n.lat,lng:n.lng });
    if(d<bestD){ bestD=d; best=n; }
  }
  return best as typeof g.nodes[keyof typeof g.nodes];
}

function distToSegmentM(p:{lat:number;lng:number}, a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  // rough projection distance
  const A=[a.lat,a.lng], B=[b.lat,b.lng], P=[p.lat,p.lng];
  const AB=[B[0]-A[0], B[1]-A[1]], AP=[P[0]-A[0], P[1]-A[1]];
  const ab2=AB[0]*AB[0]+AB[1]*AB[1]; const t=Math.max(0, Math.min(1,(AP[0]*AB[0]+AP[1]*AB[1])/(ab2||1)));
  const C=[A[0]+t*AB[0], A[1]+t*AB[1]];
  const dx=(P[0]-C[0])*111000, dy=(P[1]-C[1])*83000; // lat/lng rough meters
  return Math.hypot(dx,dy);
}

export async function routeAStar(g:RoadGraph, closures:Set<string>, risk: RiskFn, from:{lat:number;lng:number}, to:{lat:number;lng:number}, altIndex:0|1|2=0): Promise<RoutePath|null>{
  const s = nearestNode(g, from), t = nearestNode(g, to);
  if(!s||!t) {return null;}

  const open = makePQ<string>();
  const came = new Map<string,string|null>();
  const gCost = new Map<string,number>();
  const fCost = new Map<string,number>();

  const sid = s.id, tid = t.id;
  open.push(sid, 0); came.set(sid,null); gCost.set(sid,0); fCost.set(sid,0);

  const penaltyAlt = altIndex*150; // alternatifte küçük ceza farklı yolları teşvik etsin

  while(open.size()){
    const cur = open.pop()!;
    if(cur===tid) {break;}
    const out = g.out?.[cur] || [];
    for(const eid of out){
      const e = g.edges[eid]; if(!e) {continue;}
      // next node
      const next = e.a===cur ? e.b : e.a;
      const a = g.nodes[e.a], b = g.nodes[e.b];
      if(!a||!b) {continue;}
      const mid = { lat:(a.lat+b.lat)/2, lng:(a.lng+b.lng)/2 };
      const closed = closures.has(eid);
      const base = e.distM || haversineM(a,b);
      const riskC = risk(mid.lat, mid.lng);
      const closeC = closed? 1e6 : 0; // kapanmışsa çok büyük ceza
      const kindC = e.kind==='primary' ? 0.9 : e.kind==='secondary' ? 1.0 : 1.1;
      let drawC = 0;
      // lightweight sampling: penalize if near any drawing segment (<40m)
      try{
        const ds = await listShapes(300);
        outer: for(const d of ds){
          for(let i=0;i<d.coords.length-1;i++){
            if(distToSegmentM(mid, d.coords[i], d.coords[i+1])<40){ drawC += 600; break outer; }
          }
        }
      }catch{
        // Ignore drawing shape errors
      }
      const cost = base*kindC*(1 + riskC) + closeC + drawC + penaltyAlt;

      const prev = gCost.get(cur)!;
      const ng = prev + cost;
      if(ng < (gCost.get(next) ?? Infinity)){
        came.set(next, cur);
        gCost.set(next, ng);
        const h = haversineM(g.nodes[next], g.nodes[tid]); // heuristic
        const f = ng + h*(1.0 + risk(to.lat,to.lng));
        fCost.set(next, f);
        open.push(next, f);
      }
    }
  }

  // reconstruct
  const path: string[] = [];
  let u: string | undefined = tid;
  if(!came.has(tid)) {return null;}
  while(u){ path.unshift(u); u = came.get(u) || undefined; }
  if(!path.length) {return null;}

  // to edges + coords
  const edges: string[] = [];
  const coords: {lat:number;lng:number}[] = [];
  let dist=0, rsum=0;
  for(let i=0; i<path.length-1; i++){
    const n1 = g.nodes[path[i]], n2 = g.nodes[path[i+1]];
    coords.push({ lat:n1.lat, lng:n1.lng });
    const eid = (g.out?.[n1.id]||[]).find(id=> {
      const e = g.edges[id]; return e && ((e.a===n1.id && e.b===n2.id) || (e.b===n1.id && e.a===n2.id));
    });
    if(eid){ edges.push(eid); }
    const mid = { lat:(n1.lat+n2.lat)/2, lng:(n1.lng+n2.lng)/2 };
    dist += haversineM(n1,n2);
    rsum += risk(mid.lat, mid.lng);
  }
  coords.push({ lat: g.nodes[ path[path.length-1] ].lat, lng: g.nodes[ path[path.length-1] ].lng });

  return { id: 'route_'+Date.now()+'_'+altIndex, from, to, edges: edges as any, coords, distM: dist, riskCost: rsum, altIndex };
}
