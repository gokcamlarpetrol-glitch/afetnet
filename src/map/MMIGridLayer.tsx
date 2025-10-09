import React, { useEffect, useState } from "react";
import { Circle } from "react-native-maps";
import { GridBundle, loadGrid } from "../risk/grid";

function colorFor(mmi:number){
  if(mmi>=7.5) {return "rgba(239,68,68,0.35)";}   // red
  if(mmi>=6.0) {return "rgba(245,158,11,0.35)";}  // amber
  if(mmi>=4.5) {return "rgba(59,130,246,0.30)";}  // blue
  return "rgba(16,185,129,0.25)";               // green
}

export default function MMIGridLayer(){
  const [grid,setGrid]=useState<GridBundle|null>(null);
  useEffect(()=>{
    const t=setInterval(async()=> setGrid(await loadGrid()), 5000);
    (async()=>setGrid(await loadGrid()))();
    return ()=>clearInterval(t);
  },[]);
  if(!grid) {return null;}

  // Çember yarıçapını stepDeg'e göre yaklaşık km cinsinden ayarla (~111km/deg)
  const rKm = Math.max(8, grid.stepDeg*111/2);
  return (
    <>
      {grid.cells.map((c,idx)=>(
        <Circle
          key={idx}
          center={{ latitude:c.lat, longitude:c.lng }}
          radius={rKm*1000}
          strokeWidth={0}
          fillColor={colorFor(c.mmi)}
          zIndex={1}
        />
      ))}
    </>
  );
}



