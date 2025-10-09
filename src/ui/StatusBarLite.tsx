import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import * as Battery from "expo-battery";
import NetInfo from "@react-native-community/netinfo";
import { useApp } from "../store/app";

export default function StatusBarLite(){
  const { size } = useApp();
  const [bat,setBat]=useState<number|null>(null);
  const [online,setOnline]=useState<boolean>(true);

  useEffect(()=>{
    Battery.getBatteryLevelAsync().then(l=>setBat(Math.round((l??0)*100)));
    const unsubN = NetInfo.addEventListener(s=>setOnline(!!s.isConnected));
    const t = setInterval(()=>Battery.getBatteryLevelAsync().then(l=>setBat(Math.round((l??0)*100))), 30000);
    return ()=>{ unsubN(); clearInterval(t); };
  },[]);

  return (
    <View style={{flexDirection:"row", gap:12, padding:8, backgroundColor:"#0b1220"}}>
      <Text style={{color:"#cbd5e1"}}>Pil: {bat ?? "?"}%</Text>
      <Text style={{color: online ? "#22c55e" : "#f97316"}}>{online ? "Çevrimiçi" : "Çevrimdışı"}</Text>
      <Text style={{color:"#cbd5e1"}}>Kuyruk: {size()}</Text>
    </View>
  );
}



