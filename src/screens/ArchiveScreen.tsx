import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { exportZip } from "../export/zip";

export default function ArchiveScreen(){
  const [hours, setHours] = useState("2");
  async function doZip(){
    const h = Math.max(1, parseInt(hours||"2",10));
    const p = await exportZip(h, "saha");
    Alert.alert("Arşiv", "Hazır: "+p);
  }
  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Arşiv (.zip)</Text>
      <Text style={{color:"#e5e7eb", marginTop:8}}>Dahil: OCB + GeoJSON iz + CAP + görevler + otomatik loglar</Text>
      <TextInput value={hours} onChangeText={setHours} keyboardType="number-pad" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10, marginVertical:10}} />
      <Pressable onPress={doZip} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
        <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>ZIP Oluştur</Text>
      </Pressable>
    </View>
  );
}



