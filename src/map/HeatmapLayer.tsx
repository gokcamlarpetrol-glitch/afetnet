import React, { useEffect, useState } from "react";
import { Heatmap } from "react-native-maps";
import { listInbox } from "../msg/store";

export default function HeatmapLayer(){
  const [pts,setPts]=useState<any[]>([]);
  async function load(){
    const msgs = await listInbox();
    const now=Date.now();
    setPts(msgs.filter((m:any)=>["sos","ping"].includes(m.kind) && m.qlat && m.qlng && now-m.ts<300000)
      .map((m:any)=>({ latitude:m.qlat, longitude:m.qlng, weight:1 })));
  }
  useEffect(()=>{ load(); const t=setInterval(load,10000); return ()=>clearInterval(t); },[]);
  if(!pts.length) {return null;}
  return <Heatmap points={pts} radius={50} opacity={0.6} />;
}
