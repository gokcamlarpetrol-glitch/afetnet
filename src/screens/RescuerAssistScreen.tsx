import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { getConvoy } from "../p2p/bleCourier";
import { startWhisper, stopWhisper } from "../guidance/whisperNav";
import { haversineM } from "../routing/types";

export default function RescuerAssistScreen(){
  const [target,setTarget]=useState<{id:string;lat:number;lng:number}|null>(null);
  const [dist,setDist]=useState<number>(0);

  async function findNearest(){
    const p = await Location.getLastKnownPositionAsync({}).catch(()=>null);
    if(!p) {return;}
    const me = { lat:p.coords.latitude, lng:p.coords.longitude };
    const arr = getConvoy();
    let best:any=null, bestD=1e12;
    for(const x of arr){
      const d = haversineM(me, {lat:x.lat,lng:x.lng});
      if(d<bestD){ bestD=d; best=x; }
    }
    if(best){ setTarget({ id:best.id, lat:best.lat, lng:best.lng }); setDist(bestD); }
  }

  useEffect(()=>{ const t=setInterval(async()=>{ await findNearest(); }, 8000); findNearest(); return ()=>clearInterval(t); },[]);

  async function guide(){
    await startWhisper("low");
    // basit guidance: her 10 sn'de bir titreşim; mesafe azalınca hızlanır
    let on = true;
    (async function loop(){
      while(on){
        const d = dist;
        await Haptics.notificationAsync(d<50? Haptics.NotificationFeedbackType.Success :
          d<150? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error).catch(()=>{});
        await new Promise(r=>setTimeout(r, d<50? 2000 : d<150? 4000 : 7000));
      }
    })();
    // stop when unmount
    return ()=>{ on=false; };
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center", padding:16 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Yakın Kurtarıcı</Text>
      {target? (
        <>
          <Text style={{ color:"#93c5fd", marginTop:6 }}>Hedef: {target.id}</Text>
          <Text style={{ color:"#a7f3d0" }}>Mesafe ≈ {(dist).toFixed(0)} m</Text>
          <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
            <Pressable onPress={guide} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>YOL GÖSTER</Text></Pressable>
            <Pressable onPress={stopWhisper} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>DURDUR</Text></Pressable>
          </View>
          <Text style={{ color:"#94a3b8", fontSize:11, marginTop:10, textAlign:"center" }}>
            Not: Yönlendirme basittir (mesafeye bağlı uyarı hızı). Tam rota için Rota Planlayıcı kullanın.
          </Text>
        </>
      ):(
        <Text style={{ color:"#cbd5e1", marginTop:6 }}>Yakın konvoy/kurtarıcı ping'i bekleniyor…</Text>
      )}
    </View>
  );
}



