import { GridBundle, loadGrid } from "../risk/grid";

/** MMI→ceza (0..1) kaba eşleme */
export function riskFromMMI(mmi:number){
  if(mmi>=7.5) {return 1.0;}
  if(mmi>=6.0) {return 0.6;}
  if(mmi>=4.5) {return 0.25;}
  return 0.05;
}

export async function makeRiskFn(){
  const g = await loadGrid();
  if(!g) {return (lat:number,lng:number)=> 0.05;}
  const step = g.stepDeg || 0.2;
  return (lat:number,lng:number)=>{
    // en yakın hücre
    let best = 0.05; let bestD = 1e9;
    for(const c of g.cells){
      const d = Math.hypot(c.lat-lat, c.lng-lng);
      if(d<bestD){ bestD=d; best = riskFromMMI(c.mmi); }
    }
    return best;
  };
}



