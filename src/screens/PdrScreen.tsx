import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { startPDR, stopPDR } from "../pdr/pdr";
import { readTrail, clearTrail } from "../pdr/store";
import QRCodeSafe from "../ui/QRCodeSafe";

export default function PDRScreen(){
  const [trail,setTrail]=useState<any[]>([]);
  async function refresh(){ setTrail((await readTrail(200)).slice(-200)); }
  useEffect(()=>{ const t=setInterval(refresh,2000); refresh(); return ()=>clearInterval(t); },[]);
  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Ekmek Kırıntısı İzleri (PDR)</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={()=>startPDR()} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:8 }}><Text style={{ color:"white" }}>BAŞLAT</Text></Pressable>
        <Pressable onPress={()=>stopPDR()} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8 }}><Text style={{ color:"white" }}>DURDUR</Text></Pressable>
        <Pressable onPress={async()=>{ await clearTrail(); await refresh(); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8 }}><Text style={{ color:"white" }}>TEMİZLE</Text></Pressable>
      </View>
      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:10, marginTop:12, alignItems:"center" }}>
        <Text style={{ color:"#e5e7eb" }}>Son 200 Noktanın QR'ı</Text>
        <QRCodeSafe value={JSON.stringify(trail.slice(-200))} size={220} color="#000" backgroundColor="#fff"/>
      </View>
      <Text style={{ color:"#94a3b8", fontSize:12, marginTop:8 }}>GPS gelince PDR sıfırlanır; aksi halde adım yönüne göre ~0.7m eklenir.</Text>
    </ScrollView>
  );
}
