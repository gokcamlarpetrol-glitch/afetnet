import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { loadFamily } from "../family/store";
function haversine(a:any,b:any){const R=6371000;const toR=(x:number)=>x*Math.PI/180;const dLat=toR(b.lat-a.lat), dLng=toR(b.lng-a.lng);const s=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
export default function FamilyProximityScreen(){
  const [near,setNear]=useState<{name:string;d:number}|null>(null);
  async function scan(){
    const fam = await loadFamily();
    const p = await Location.getLastKnownPositionAsync({}).catch(()=>null); if(!p) {return;}
    const me={lat:p.coords.latitude,lng:p.coords.longitude};
    let best:any=null, bestD=1e12;
    for(const f of fam){ if(f.qlat && f.qlng){ const d=haversine(me,{lat:f.qlat,lng:f.qlng}); if(d<bestD){ bestD=d; best=f; } } }
    if(best){ setNear({ name:best.name, d: bestD }); await Haptics.impactAsync(bestD<50? Haptics.ImpactFeedbackStyle.Heavy: Haptics.ImpactFeedbackStyle.Light); }
  }
  useEffect(()=>{ const t=setInterval(scan, 6000); scan(); return ()=>clearInterval(t); },[]);
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Aile Yakınlık</Text>
      <Text style={{ color:"#93c5fd", marginTop:6 }}>{near? `${near.name}: ~${near.d.toFixed(0)} m`:"—"}</Text>
      <Pressable onPress={scan} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10, marginTop:10 }}><Text style={{ color:"white" }}>TARA</Text></Pressable>
    </View>
  );
}



