import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { runPreflight } from "../safety/preflight";

export default function PreflightScreen(){
  const [rows,setRows]=useState<{key:string;ok:boolean;note?:string}[]>([]);
  async function run(){ const r = await runPreflight(); setRows(r.checks); }
  useEffect(()=>{ run(); },[]);
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Yayın Öncesi Güvenlik Kontrolü</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={run} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>TEKRAR ÇALIŞTIR</Text></Pressable>
      </View>
      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.key}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:item.ok? "#10b981":"#ef4444", fontWeight:"700" }}>{item.key} → {item.ok? "OK":"EKSİK"}</Text>
            {!!item.note && <Text style={{ color:"#cbd5e1" }}>{item.note}</Text>}
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Amaç: Yayından önce kritik bağımlılıkları doğrulamak.</Text>
    </View>
  );
}