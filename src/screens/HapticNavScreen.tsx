import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { startHapticHeading, stopHapticHeading } from "../nav/hapticHeading";

export default function HapticNavScreen(){
  const [target,setTarget]=useState<{lat:number;lng:number}|null>(null);
  const headRef = useRef(0);
  const meRef = useRef<{lat:number;lng:number}|null>(null);

  useEffect(()=>{
    const sub = Magnetometer.addListener((d)=>{ 
      const angle = Math.atan2(d.y, d.x) * (180/Math.PI);
      headRef.current = (angle + 360) % 360;
    });
    Magnetometer.setUpdateInterval(300);
    const t = setInterval(async()=>{
      const p = await Location.getLastKnownPositionAsync({}); if(p){ meRef.current = { lat:p.coords.latitude, lng:p.coords.longitude }; }
    }, 1500);
    return ()=>{ sub.remove(); clearInterval(t); stopHapticHeading(); };
  },[]);

  function start(){
    if(!target) {return;}
    startHapticHeading(()=>headRef.current, ()=>meRef.current, ()=>target);
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Titreşimle Yön Bulma</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={async()=>{ const p=await Location.getLastKnownPositionAsync({}); if(p){ setTarget({ lat:p.coords.latitude+0.001, lng:p.coords.longitude }); } }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8 }}>
          <Text style={{ color:"white" }}>Örnek Hedef Ayarla (+~100m)</Text>
        </Pressable>
        <Pressable onPress={start} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:8 }}>
          <Text style={{ color:"white" }}>Başlat</Text>
        </Pressable>
        <Pressable onPress={()=>stopHapticHeading()} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8 }}>
          <Text style={{ color:"white" }}>Durdur</Text>
        </Pressable>
      </View>
      {!!target && <Text style={{ color:"#93c5fd", marginTop:10, fontSize:12 }}>Hedef: {target.lat.toFixed(5)}, {target.lng.toFixed(5)}</Text>}
      <Text style={{ color:"#94a3b8", marginTop:10, fontSize:12 }}>Not: Pusula manyetik parazitlerden etkilenebilir; doğruluk için telefonu yatay tut.</Text>
    </View>
  );
}



