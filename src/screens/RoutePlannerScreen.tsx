import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { loadGraph, listClosures } from "../routing/store";
import { makeRiskFn } from "../routing/risk";
import { routeAStar } from "../routing/astar";
import { broadcastRoute } from "../routing/share";

type R = { id:string; coords:{latitude:number;longitude:number}[]; distKm:number; risk:number; alt:0|1|2 };

export default function RoutePlannerScreen(){
  const [from,setFrom]=useState<{lat:number;lng:number}|null>(null);
  const [to,setTo]=useState<{lat:number;lng:number}|null>(null);
  const [routes,setRoutes]=useState<R[]>([]);
  const [ready,setReady]=useState(false);

  useEffect(()=>{ (async()=>{
    const g=await loadGraph(); setReady(!!g);
    if(!from){ const p=await Location.getLastKnownPositionAsync({}).catch(()=>null); if(p){ setFrom({ lat:p.coords.latitude, lng:p.coords.longitude }); } }
  })(); },[]);

  async function plan(){
    const g = await loadGraph(); if(!g){ Alert.alert("Yol Ağı Yok","DataPack ile yol verisi yükleyin"); return; }
    if(!from||!to){ Alert.alert("Koordinat","\"From/To\" girin"); return; }
    const risk = await makeRiskFn();
    const cls = new Set((await listClosures()).map(c=>c.edgeId));
    const r0 = await routeAStar(g, cls, risk, from, to, 0);
    const r1 = await routeAStar(g, cls, risk, from, to, 1);
    const r2 = await routeAStar(g, cls, risk, from, to, 2);
    const arr = [r0,r1,r2].filter(Boolean).map(r=>({
      id: r!.id, coords: r!.coords.map(p=>({ latitude:p.lat, longitude:p.lng })), distKm: r!.distM/1000, risk: r!.riskCost, alt: r!.altIndex
    })) as R[];
    setRoutes(arr.sort((a,b)=> (a.distKm+a.risk) - (b.distKm+b.risk)));
  }

  async function share(idx:number){
    if(!routes[idx]) {return;}
    await broadcastRoute({ id: routes[idx].id, coords: routes[idx].coords.map(p=>({ lat:p.latitude, lng:p.longitude })), ts: Date.now() });
    Alert.alert("Yayınlandı","Rota ekip ile paylaşıldı (mesh).");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <View style={{ padding:12 }}>
        <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Rota Planlayıcı {ready? "":"• Yol verisi yok"}</Text>
        <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
          <TextInput placeholder="From lat,lng" placeholderTextColor="#94a3b8" value={from? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}`:""} onChangeText={(v)=>{ const m=v.split(","); if(m.length===2) {setFrom({ lat:parseFloat(m[0]), lng:parseFloat(m[1])});} }} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          <TextInput placeholder="To lat,lng" placeholderTextColor="#94a3b8" value={to? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`:""} onChangeText={(v)=>{ const m=v.split(","); if(m.length===2) {setTo({ lat:parseFloat(m[0]), lng:parseFloat(m[1])});} }} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        </View>
        <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
          <Pressable onPress={plan} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>PLANLA</Text></Pressable>
          <Pressable onPress={()=>share(0)} style={{ backgroundColor:"#10b981", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>ROTAYI YAYINLA</Text></Pressable>
        </View>
      </View>
      <MapView style={{ flex:1 }} initialRegion={{ latitude:39, longitude:35, latitudeDelta:8, longitudeDelta:8 }}>
        {from && <Marker coordinate={{ latitude:from.lat, longitude:from.lng }} title="From"/>}
        {to && <Marker coordinate={{ latitude:to.lat, longitude:to.lng }} title="To"/>}
        {routes.map((r,i)=>(
          <Polyline key={r.id} coordinates={r.coords} strokeWidth={4+(i===0?1:0)} strokeColor={i===0?"#22c55e": i===1?"#f59e0b":"#60a5fa"} />
        ))}
      </MapView>
      <View style={{ padding:8, backgroundColor:"#0b1220" }}>
        <FlatList
          data={routes}
          keyExtractor={(x)=>x.id}
          horizontal
          renderItem={({item,index})=>(
            <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginRight:8 }}>
              <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>Alternatif {item.alt+1}</Text>
              <Text style={{ color:"#a7f3d0" }}>{item.distKm.toFixed(2)} km • risk {item.risk.toFixed(1)}</Text>
              <Pressable onPress={()=>share(index)} style={{ backgroundColor:"#1f2937", padding:6, borderRadius:8, marginTop:6 }}>
                <Text style={{ color:"white" }}>Paylaş</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </View>
  );
}



