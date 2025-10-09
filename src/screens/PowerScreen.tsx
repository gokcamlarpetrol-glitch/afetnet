import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { isEpmOn, enableEPM, disableEPM, loadEpmState } from "../power/epm";

export default function PowerScreen(){
  const [on, setOn] = useState(false);
  useEffect(()=>{ loadEpmState().then(()=> setOn(isEpmOn())); },[]);
  async function toggle(){
    try{
      if (isEpmOn()){ await disableEPM(); setOn(false); }
      else { await enableEPM(); setOn(true); }
    }catch(e:any){ Alert.alert("Güç", e?.message || "Açılamadı"); }
  }
  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:20}}>Acil Güç Modu</Text>
      <Text style={{color:"#94a3b8", marginBottom:12}}>Tarama daha seyrek, ekran daha loş. Pil ömrü ↑</Text>
      <Pressable onPress={toggle} style={{backgroundColor:on?"#ef4444":"#22c55e", padding:14, borderRadius:12}}>
        <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>{on ? "Kapat" : "Aç"}</Text>
      </Pressable>
      <Text style={{color:"#64748b", marginTop:10, fontSize:12}}>Not: iOS/Android arka plan kısıtlamaları değişkendir; kritik görevlerde ekranı açık tutmak en güvenilir yöntemdir.</Text>
    </View>
  );
}



