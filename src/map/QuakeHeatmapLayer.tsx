import React, { useEffect, useState } from "react";
import { Heatmap } from "react-native-maps";
import { readQuakes24h } from "../quake/store";

export default function QuakeHeatmapLayer(){
  const [pts,setPts]=useState<any[]>([]);
  useEffect(()=>{
    const t=setInterval(async()=>{
      const qs=await readQuakes24h();
      setPts(qs.map(q=>({ latitude:q.lat, longitude:q.lng, weight:q.mag })));
    },10000);
    return ()=>clearInterval(t);
  },[]);
  if(!pts.length) {return null;}
  return <Heatmap points={pts} radius={80} opacity={0.5} gradient={{ colors:["#3b82f6","#f59e0b","#ef4444"], startPoints:[0.2,0.6,1], colorMapSize:256 }}/>;
}



