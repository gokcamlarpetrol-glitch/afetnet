import React from "react";
import { Pressable, Text, View } from "react-native";
import { startTrapped, stopTrapped } from "../trapped/mode";

export default function TrappedScreen(){
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Enkaz Modu</Text>
      <Text style={{ color:"#94a3b8", textAlign:"center", marginVertical:8 }}>Hareketsizlikte otomatik SOS, sesli ping ve ses algılama devrede.</Text>
      <View style={{ flexDirection:"row", gap:8 }}>
        <Pressable onPress={startTrapped} style={{ backgroundColor:"#ef4444", padding:10, borderRadius:10 }}><Text style={{ color:"white", fontWeight:"800" }}>BAŞLAT</Text></Pressable>
        <Pressable onPress={stopTrapped} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>DURDUR</Text></Pressable>
      </View>
    </View>
  );
}