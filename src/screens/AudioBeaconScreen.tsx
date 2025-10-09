import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { startAudioBeacon, stopAudioBeacon, isAudioBeaconOn } from "../assist/audioTx";

export default function AudioBeaconScreen(){
  const [on, setOn] = useState(false);
  useEffect(()=>{ setOn(isAudioBeaconOn()); },[]);
  async function toggle(){
    try{
      if (isAudioBeaconOn()){ await stopAudioBeacon(); setOn(false); }
      else { await startAudioBeacon(); setOn(true); }
    }catch(e:any){ Alert.alert("Ses", e?.message || "Başlatılamadı"); }
  }
  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:16, alignItems:"center", justifyContent:"center"}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Acil Ses Beacon (1.8kHz)</Text>
      <Text style={{color:"#94a3b8", marginBottom:10, textAlign:"center"}}>Yakındaki ekiplerin akustik yön bulma ekranıyla hizalanır. Ortam uygunsa kullan.</Text>
      <Pressable onPress={toggle} style={{backgroundColor:on?"#ef4444":"#22c55e", paddingVertical:14, paddingHorizontal:18, borderRadius:12}}>
        <Text style={{color:"white", fontWeight:"800"}}>{on ? "Durdur" : "Başlat"}</Text>
      </Pressable>
      <Text style={{color:"#64748b", marginTop:10, fontSize:12}}>Not: Cihaz sessizde ise zil/medya sesi kapalı olabilir.</Text>
    </View>
  );
}



