import React, { useEffect, useState } from "react";
// import MapView, { Polyline } from "react-native-maps"; // Temporarily disabled for Expo Go
import { readTrack, startTrack, stopTrack } from "../track/bread";
import { Pressable, Text, View } from "react-native";

export default function TrackScreen(){
  const [pts,setPts]=useState<{lat:number;lng:number}[]>([]);
  useEffect(()=>{ const t=setInterval(async()=> setPts(await readTrack()), 4000); return ()=>clearInterval(t); },[]);
  return (
    <View style={{ flex:1 }}>
      <MapView style={{ flex:1 }} initialRegion={{ latitude:39, longitude:35, latitudeDelta:6, longitudeDelta:6 }}>
        {pts.length>1 && <Polyline coordinates={pts.map(p=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={5} strokeColor="#22c55e" />}
      </MapView>
      <View style={{ position:"absolute", bottom:8, left:8, right:8, backgroundColor:"#0b1220", padding:8, borderRadius:10 }}>
        <View style={{ flexDirection:"row", gap:8 }}>
          <Pressable onPress={()=>startTrack(15)} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>İZİ BAŞLAT</Text></Pressable>
          <Pressable onPress={stopTrack} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>DURDUR</Text></Pressable>
        </View>
      </View>
    </View>
  );
}



