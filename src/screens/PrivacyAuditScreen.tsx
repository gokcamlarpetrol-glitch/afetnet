import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { isInspect, readAudit, setInspect, writeAudit } from "../safety/audit";

export default function PrivacyAuditScreen(){
  const [rows,setRows]=useState<any[]>([]);
  const [inspect,setIns]=useState(false);

  async function refresh(){ setRows(await readAudit()); setIns(await isInspect()); }
  useEffect(()=>{ refresh(); const t=setInterval(refresh,3000); return ()=>clearInterval(t); },[]);

  async function toggle(){
    const v = !inspect; await setInspect(v); setIns(v);
    await writeAudit("user", v? "audit.inspect.on":"audit.inspect.off",{});
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Gizlilik & Denetim</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={toggle} style={{ backgroundColor: inspect? "#ef4444":"#1f2937", padding:8, borderRadius:8 }}>
          <Text style={{ color:"white" }}>İnceleme Modu: {inspect? "AÇIK":"KAPALI"}</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ marginTop:10 }}
        data={rows.slice().reverse()}
        keyExtractor={(_,i)=>String(i)}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{new Date(item.ts).toLocaleString()}</Text>
            <Text style={{ color:"#93c5fd" }}>{item.actor} • {item.action}</Text>
            {!!item.detail && <Text style={{ color:"#cbd5e1", fontSize:12 }}>{JSON.stringify(item.detail)}</Text>}
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Not: Günlükler cihazdadır; dışa aktarım yoktur.</Text>
    </View>
  );
}



