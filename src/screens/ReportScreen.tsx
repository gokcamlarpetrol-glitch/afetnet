import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { buildReport } from "../report/pdf";

export default function ReportScreen(){
  const [last,setLast]=useState<string>("");
  async function run(){
    const p = await buildReport();
    setLast(p.split("/").pop()||"");
  }
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center", padding:16 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Operasyon Raporu (PDF)</Text>
      <Text style={{ color:"#94a3b8", textAlign:"center", marginVertical:8 }}>OpsLog + Mesh Health + Lojistik + Görev + Hazard özetini A4 PDF olarak üretir.</Text>
      <Pressable onPress={run} style={{ backgroundColor:"#2563eb", padding:12, borderRadius:10 }}>
        <Text style={{ color:"white", fontWeight:"800" }}>PDF OLUŞTUR & PAYLAŞ</Text>
      </Pressable>
      {!!last && <Text style={{ color:"#93c5fd", fontSize:12, marginTop:10 }}>Son: {last}</Text>}
    </View>
  );
}



