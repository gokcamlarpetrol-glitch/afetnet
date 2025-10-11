import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { debugP2P } from "../p2p/bleCourier";

export default function DiagnosticsScreen(){
  const [rows,setRows]=useState<{k:string;v:any}[]>([]);
  useEffect(()=>{
    const t=setInterval(()=> {
      const d = debugP2P();
      setRows(Object.entries(d).map(([k,v])=>({k, v})));
    }, 1000);
    return ()=>clearInterval(t);
  },[]);
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Diagnostik</Text>
      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.k}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.k}</Text>
            <Text style={{ color:"#93c5fd", fontSize:12 }}>{JSON.stringify(item.v).slice(0,1000)}</Text>
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Not: Bu ekran saha testleri içindir.</Text>
    </View>
  );
}