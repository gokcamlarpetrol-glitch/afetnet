import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { makeManifest } from "../share/store";
import { broadcastOffer } from "../share/mesh";
import { getOffers } from "../p2p/bleCourier";

export default function PackShareScreen(){
  const [offers,setOffers]=useState<any[]>([]);
  useEffect(()=>{ const t=setInterval(()=> setOffers(getOffers()), 3000); return ()=>clearInterval(t); },[]);

  async function pick(kind:"tilepack"|"mbtiles"|"datapack"){
    const d = await DocumentPicker.getDocumentAsync({ type:"*/*", copyToCacheDirectory:true });
    if(d.canceled || !d.assets?.length) {return;}
    const man = await makeManifest(d.assets[0].uri, kind);
    await broadcastOffer(man);
    Alert.alert("İlan", "Paket ilanı mesh'e yayınlandı.\nYakın cihaz chunk isteyebilir.");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>P2P Dosya Dağıtımı</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap" }}>
        <Pressable onPress={()=>pick("tilepack")} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>TilePack İlan</Text></Pressable>
        <Pressable onPress={()=>pick("mbtiles")} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>MBTiles İlan</Text></Pressable>
        <Pressable onPress={()=>pick("datapack")} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>DataPack İlan</Text></Pressable>
      </View>
      <FlatList
        style={{ marginTop:10 }}
        data={offers}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.man.name}</Text>
            <Text style={{ color:"#93c5fd" }}>{item.man.kind} • {Math.round(item.man.size/1024)} KB • {item.man.chunks} parça</Text>
            <Text style={{ color:"#cbd5e1", fontSize:12 }}>SHA256 (kısaltılmış): {item.man.sha256.slice(0,16)}…</Text>
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Not: Chunk istek/gönder akışı BLE courier'e ek fazda bağlanacak; bu faz "ilan/manifest"i sağlar.</Text>
    </View>
  );
}



