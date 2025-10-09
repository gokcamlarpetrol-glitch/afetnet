import React, { useEffect, useState } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Text, View } from "react-native";
import * as Location from "expo-location";
import { quantizeLatLng } from "../geo/coarse";
import { readTrail } from "../pdr/store";
import { p2pLocalSend } from "../p2p/send";
import { getSharedRoutes } from "../p2p/bleCourier";

type Ping = { id:string; ts:number; lat:number; lng:number };
const myId = "me";

export default function ConvoyMapScreen(){
  const [trail,setTrail]=useState<any[]>([]);
  const [pings,setPings]=useState<Ping[]>([]);
  const [routes,setRoutes]=useState<{id:string;coords:{latitude:number;longitude:number}[]}[]>([]);

  useEffect(()=>{
    const t1=setInterval(async()=> setTrail(await readTrail(100)), 3000);
    const t2=setInterval(async()=>{
      try{
        const p=await Location.getLastKnownPositionAsync({}); if(!p) {return;}
        const q=quantizeLatLng(p.coords.latitude,p.coords.longitude);
        await p2pLocalSend({ kind:"convoy_ping", v:1, id: myId, lat:q.lat, lng:q.lng, ts: Date.now() });
      }catch{}
    }, 20_000);
    const t3=setInterval(()=> {
      const arr = getSharedRoutes().map(r=>({ id:r.id, coords: r.coords.map(p=>({ latitude:p.lat, longitude:p.lng })) }));
      setRoutes(arr);
    }, 3000);
    return ()=>{ clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  },[]);

  // Listen: patch BLE courier
  // (already handled globally in previous phases: add handler there)
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <MapView style={{ flex:1 }} initialRegion={{ latitude:39, longitude:35, latitudeDelta:6, longitudeDelta:6 }}>
        {trail.length>1 && <Polyline coordinates={trail.map((p:any)=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={2} />}
        {routes.map(r=> <Polyline key={r.id} coordinates={r.coords} strokeWidth={5} strokeColor="#22c55e" />)}
        {pings.map((p,i)=> <Marker key={i} coordinate={{ latitude:p.lat, longitude:p.lng }} title={p.id} />)}
      </MapView>
      <View style={{ position:"absolute", bottom:6, left:6, right:6, backgroundColor:"rgba(0,0,0,0.55)", padding:6, borderRadius:8 }}>
        <Text style={{ color:"#cbd5e1", fontSize:11, textAlign:"center" }}>Konvoy Ping: 20 sn'de bir anonimleştirilmiş (~coarse) konum paylaşır.</Text>
      </View>
    </View>
  );
}
