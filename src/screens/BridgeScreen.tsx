import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { startBridge, stopBridge, bridgeMetrics } from "../transports/bridge";

export default function BridgeScreen(){
  const [on,setOn]=useState(false);
  const [met,setMet]=useState<any[]>([]);
  async function load(){ setMet(bridgeMetrics()); }
  useEffect(()=>{ const t=setInterval(load,1000); return ()=>clearInterval(t); },[]);
  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Köprü Modu</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={async()=>{ await startBridge("AFETNET-WFD"); setOn(true); }} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>AÇ</Text></Pressable>
        <Pressable onPress={async()=>{ await stopBridge(); setOn(false); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>KAPAT</Text></Pressable>
      </View>
      <Text style={{ color:"#93c5fd", marginTop:6 }}>{on? "Aktif":"Kapalı"}</Text>
      <View style={{ marginTop:10 }}>
        {met.map((m,i)=>(
          <View key={i} style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"white" }}>{m.kind.toUpperCase()} — {m.id}</Text>
            <Text style={{ color:"#94a3b8", fontSize:12 }}>UP: {String(m.up)} • TX:{m.tx} • RX:{m.rx} • ERR:{m.errors}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color:"#94a3b8", fontSize:12, marginTop:8 }}>Not: WFD/LoRa bağlantıları geliştirilme aşamasındadır.</Text>
    </ScrollView>
  );
}



