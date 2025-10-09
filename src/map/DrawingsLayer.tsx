import React, { useEffect, useState } from "react";
import { Polyline } from "react-native-maps";
import { listShapes } from "../draw/store";

function color(kind:string){ return kind==="rubble"?"#ef4444": kind==="flood"?"#3b82f6": kind==="blocked"?"#f59e0b": "#a855f7"; }

export default function DrawingsLayer(){
  const [lines,setLines]=useState<{kind:string; coords:{lat:number;lng:number}[]}[]>([]);
  useEffect(()=>{
    const t=setInterval(async()=>{ const arr=await listShapes(); setLines(arr.map(x=>({ kind:x.kind, coords:x.coords }))); }, 4000);
    return ()=>clearInterval(t);
  },[]);
  return (
    <>
      {lines.map((l,idx)=>(
        <Polyline key={idx} coordinates={l.coords.map(p=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={5} strokeColor={color(l.kind)} />
      ))}
    </>
  );
}



