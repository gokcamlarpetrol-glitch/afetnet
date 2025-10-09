import React, { useEffect, useState } from "react";
import { Polyline } from "react-native-maps";
import { listClosures, loadGraph } from "../routing/store";

export default function ClosuresLayer(){
  const [lines,setLines]=useState<{coords:{lat:number;lng:number}[]}[]>([]);
  useEffect(()=>{
    const t=setInterval(async()=>{
      const g=await loadGraph(); if(!g) {return;}
      const cls = await listClosures();
      const out: {coords:{lat:number;lng:number}[]}[] = [];
      for(const c of cls){
        const e = g.edges[c.edgeId]; if(!e) {continue;}
        const a = g.nodes[e.a], b = g.nodes[e.b]; if(!a||!b) {continue;}
        out.push({ coords: [{lat:a.lat,lng:a.lng},{lat:b.lat,lng:b.lng}] });
      }
      setLines(out);
    }, 4000);
    return ()=>clearInterval(t);
  },[]);
  return (
    <>
      {lines.map((l,idx)=>(
        <Polyline key={idx} coordinates={l.coords.map(p=>({latitude:p.lat, longitude:p.lng}))} strokeWidth={6} strokeColor="#ef4444" />
      ))}
    </>
  );
}



