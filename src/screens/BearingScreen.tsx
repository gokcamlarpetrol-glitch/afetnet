import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as Beacon from "../ble/bridge";

type Peer = { id:string; lat:number; lon:number; ts:number };
function bearing(from:{lat:number;lon:number}, to:{lat:number;lon:number}){
  const y = Math.sin((to.lon-from.lon)*Math.PI/180)*Math.cos(to.lat*Math.PI/180);
  const x = Math.cos(from.lat*Math.PI/180)*Math.sin(to.lat*Math.PI/180) - Math.sin(from.lat*Math.PI/180)*Math.cos(to.lat*Math.PI/180)*Math.cos((to.lon-from.lon)*Math.PI/180);
  return (Math.atan2(y,x)*180/Math.PI + 360)%360;
}
function distance(a:{lat:number;lon:number}, b:{lat:number;lon:number}){
  const R=6371000, toR=(d:number)=>d*Math.PI/180;
  const dLat=toR(b.lat-a.lat), dLon=toR(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

export default function BearingScreen(){
  const [me, setMe] = useState<{lat:number;lon:number}|null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [head, setHead] = useState(0);

  useEffect(()=>{ (async()=>{
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status!=="granted") {return Alert.alert("Konum","İzin yok");}
    const fix = await Location.getCurrentPositionAsync({});
    setMe({ lat: fix.coords.latitude, lon: fix.coords.longitude });
    Beacon.start({ onNearby:(list:any[])=>{
      const ps = list.filter(x=>x.team && x.lat!=null).map(x=>({ id:x.id, lat:x.lat, lon:x.lon, ts:x.ts }));
      setPeers(ps);
    }});
  })(); return ()=>{ Beacon.stop(); }; },[]);

  useEffect(()=>{
    Magnetometer.setUpdateInterval(250);
    const sub = Magnetometer.addListener(({x,y})=>{
      const deg = (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
      setHead(deg);
    });
    return ()=>sub.remove();
  },[]);

  if (!me) {return <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}><Text style={{color:"#64748b"}}>Konum alınıyor…</Text></View>;}

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Yön Okları (Relative Bearing)</Text>
      <FlatList
        data={peers}
        keyExtractor={(p)=>p.id}
        renderItem={({item})=>{
          const brg = bearing(me, item);
          const dist = distance(me, item);
          const rel = (((brg - head) % 360) + 360) % 360; // 0=ilerde
          const arrow = rel<22.5||rel>337.5 ? "↑" :
                        rel<67.5 ? "↗" :
                        rel<112.5 ? "→" :
                        rel<157.5 ? "↘" :
                        rel<202.5 ? "↓" :
                        rel<247.5 ? "↙" :
                        rel<292.5 ? "←" : "↖";
          return (
            <View style={{backgroundColor:"#0b1220", padding:12, borderRadius:12, marginBottom:8}}>
              <Text style={{color:"white", fontWeight:"800"}}>{item.id.slice(0,6)}  {arrow}  {dist.toFixed(0)} m</Text>
              <Text style={{color:"#94a3b8"}}>{new Date(item.ts).toLocaleTimeString()} • mutlak brg {brg.toFixed(0)}° • baş {head.toFixed(0)}°</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{color:"#64748b"}}>Takım konumu yok (aynı PIN gerekli).</Text>}
      />
      <Text style={{color:"#64748b", fontSize:12}}>Not: 20 m altı "yakında" kabul edilir; ok ileri (↑) olduğunda doğrudan önünüzde.</Text>
    </View>
  );
}



