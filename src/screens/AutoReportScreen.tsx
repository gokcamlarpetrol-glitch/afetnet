import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { getRing, flush } from "../diag/autoLog";

export default function AutoReportScreen(){
  const [lines, setLines] = useState<string[]>([]);
  useEffect(()=>{ const t = setInterval(()=> setLines(getRing()), 1500); return ()=>clearInterval(t); },[]);
  async function onExport(){ const p = await flush(); Alert.alert("Rapor", "Kaydedildi: "+p); }
  return (
    <ScrollView style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Oto Hata/Çakışma Raporu</Text>
      <Text style={{color:"#94a3b8", marginBottom:10}}>Son kayıtlar (ring buffer):</Text>
      {lines.length===0 ? <Text style={{color:"#64748b"}}>Kayıt yok.</Text> :
        lines.map((l,idx)=><Text key={idx} style={{color:"#cbd5e1"}}>{l}</Text>)
      }
      <View style={{height:12}}/>
      <Pressable onPress={onExport} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
        <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>Raporu Dışa Aktar</Text>
      </Pressable>
    </ScrollView>
  );
}



