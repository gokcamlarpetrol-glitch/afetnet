import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BBox, downloadTiles, estimateTiles, removeAllTiles, tileStats } from "../map/tiles";
import { applyTileDiff } from "../map/tilediff";

const TR_BBOX: BBox = { minLat: 35.8, maxLat: 42.2, minLng: 26.0, maxLng: 45.0 };

export default function TilePackScreen(){
  const [bbox,setBbox]=useState<BBox>(TR_BBOX);
  const [zFrom,setZFrom]=useState(6);
  const [zTo,setZTo]=useState(14);
  const [src,setSrc]=useState("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  const [progress,setProgress]=useState<{done:number,total:number}|null>(null);
  const est = estimateTiles({ zFrom, zTo, bbox, sourceTemplate: src });

  async function start(){
    setProgress({ done:0, total: est.count });
    await downloadTiles({ zFrom, zTo, bbox, sourceTemplate: src }, (d,t)=>setProgress({done:d,total:t}));
    Alert.alert("Tamam","İndirme bitti");
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>TilePack Yöneticisi</Text>
      <Text style={{ color:"#93c5fd", marginTop:6 }}>Alan (BBox) ve zoom aralığını seçip OSM döşemelerini indir.</Text>

      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>BBox</Text>
        {(["minLat","maxLat","minLng","maxLng"] as const).map(k=>(
          <View key={k} style={{ flexDirection:"row", alignItems:"center", marginTop:6 }}>
            <Text style={{ color:"#cbd5e1", width:90 }}>{k}</Text>
            <TextInput keyboardType="numeric" value={String((bbox as any)[k])} onChangeText={(v)=>setBbox(b=>({ ...b, [k]: parseFloat(v||"0") }))} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          </View>
        ))}
        <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
          <TextInput keyboardType="numeric" value={String(zFrom)} onChangeText={(v)=>setZFrom(parseInt(v||"0",10))} placeholder="zFrom" placeholderTextColor="#94a3b8" style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          <TextInput keyboardType="numeric" value={String(zTo)} onChangeText={(v)=>setZTo(parseInt(v||"0",10))} placeholder="zTo" placeholderTextColor="#94a3b8" style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        </View>
        <Text style={{ color:"#cbd5e1", marginTop:8 }}>Kaynak: </Text>
        <TextInput value={src} onChangeText={setSrc} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <Text style={{ color:"#a7f3d0", marginTop:8 }}>Tahmini karo: {est.count.toLocaleString()} • ~{est.sizeMB.toFixed(0)} MB</Text>
        {!!progress && <Text style={{ color:"#93c5fd", marginTop:4 }}>İlerleme: {progress.done}/{progress.total}</Text>}
        <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
          <Pressable onPress={start} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>İNDİR</Text></Pressable>
          <Pressable onPress={async()=>{ await removeAllTiles(); Alert.alert("Silindi","Tüm döşemeler kaldırıldı"); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>SİL</Text></Pressable>
          <Pressable onPress={async()=>{ const s=await tileStats(); Alert.alert("Durum", `Dosya: ${s.files}\n≈ ${s.mb.toFixed(1)} MB`); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>DURUM</Text></Pressable>
          <Pressable onPress={async()=>{ await applyTileDiff("https://example.com/tiles/diff.json"); Alert.alert("Diff","TileDiff uygulandı"); }} style={{ backgroundColor:"#10b981", padding:10, borderRadius:10 }}>
            <Text style={{ color:"white" }}>DIFF UYGULA</Text>
          </Pressable>
        </View>
        <Text style={{ color:"#94a3b8", fontSize:12, marginTop:8 }}>Not: Büyük alan + yüksek zoom çok yer kaplar. İhtiyacın olan bölgeleri indir.</Text>
      </View>
    </ScrollView>
  );
}
