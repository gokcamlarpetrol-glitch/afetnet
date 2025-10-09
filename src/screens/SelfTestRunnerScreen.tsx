import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { runPreflight } from "../safety/preflight";
import { getNeighborCount } from "../p2p/peers";

export default function SelfTestRunnerScreen(){
  const [res,setRes]=useState<string>("—");
  async function run(){
    const pre = await runPreflight();
    const ne = await getNeighborCount();
    const ok = pre.checks.every(c=>c.ok) && ne>=1;
    setRes((ok?"GO":"NO-GO")+` • komşu=${ne} • eksik=${pre.checks.filter(c=>!c.ok).length}`);
  }
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Kendini Test Et</Text>
      <Pressable onPress={run} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10, marginTop:10 }}><Text style={{ color:"white" }}>ÇALIŞTIR</Text></Pressable>
      <Text style={{ color:"#e5e7eb", marginTop:10 }}>{res}</Text>
    </View>
  );
}



