import React, { useEffect, useState } from "react";
import { Marker } from "react-native-maps";
import { Facility } from "../relief/types";
import { loadFacilities } from "../relief/store";
import { getOcc, loadOcc } from "../relief/occupancy";

function color(kind: Facility["kind"]){
  if(kind==="shelter") {return "#22c55e";}
  if(kind==="clinic") {return "#ef4444";}
  if(kind==="pharmacy") {return "#f59e0b";}
  if(kind==="food") {return "#3b82f6";}
  return "#06b6d4";
}

export default function FacilitiesLayer(){
  const [arr,setArr]=useState<Facility[]>([]);
  const [tick,setTick]=useState(0);
  useEffect(()=>{ (async()=> setArr(await loadFacilities()))(); },[]);
  useEffect(()=>{
    const t=setInterval(async()=>{ await loadOcc(); setTick(x=>x+1); }, 4000);
    return ()=>clearInterval(t);
  },[]);

  return (
    <>
      {arr.map(f=>{
        const occ = f.kind==="shelter" ? (getOccColorSync(f.id)) : undefined;
        return (
          <Marker key={f.id} coordinate={{ latitude:f.lat, longitude:f.lng }} title={f.name} description={(f.note||"")} pinColor={occ || color(f.kind)} />
        );
      })}
    </>
  );
}
function lerp(a:number,b:number,t:number){ return a+(b-a)*t; }
function getOccColorSync(id:string){
  // pull cached occ value from loadOcc(); we map 0..1 to green->red
  // Since getOcc is async, we rely on loadOcc() tick to refresh layer and read from local cache via getOccCached
  const occCache = (global as any).__AFN_OCC_CACHE__ as Record<string,number>|undefined;
  let v = 0; if(occCache && typeof occCache[id]==="number") {v = occCache[id];}
  const r = Math.round(lerp(34, 239, v));   // 0x22 -> 0xef
  const g = Math.round(lerp(197, 68, v));   // 0xc5 -> 0x44
  const b = Math.round(lerp(94, 68, v));    // 0x5e -> 0x44
  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
