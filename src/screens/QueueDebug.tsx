import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { append, stats, list, verifyIntegrity, drainSim } from "../queue/v2";

export default function QueueDebug(){
  const [meta, setMeta] = useState<{pending:number;count:number;file:string}>({pending:0,count:0,file:""});
  const [last, setLast] = useState<any[]>([]);
  const [ver, setVer] = useState<{checked:number;bad:number}>({checked:0,bad:0});

  async function refresh(){
    const s = await stats();
    setMeta({ pending: s.pending, count: s.count, file: s.file });
    setLast(await list(20,true));
  }
  useEffect(()=>{ refresh(); },[]);

  async function addFake(){
    await append("note", { t: "deneme", ts: Date.now() });
    await refresh();
  }
  async function check(){
    setVer(await verifyIntegrity(50));
  }
  async function send(){
    await drainSim(25,true);
    await refresh();
  }

  const box = { backgroundColor:"#111827", borderRadius:12, padding:12, marginVertical:8 };
  const btn = { backgroundColor:"#1f2937", padding:10, borderRadius:10, marginRight:8 };

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:16 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"700" }}>Kuyruk (v2)</Text>
      <View style={box}>
        <Text style={{ color:"white" }}>Dosya: {meta.file}</Text>
        <Text style={{ color:"white" }}>Toplam: {meta.count} • Bekleyen: {meta.pending}</Text>
        <Text style={{ color:"white" }}>Bütünlük: checked={ver.checked} bad={ver.bad}</Text>
      </View>
      <View style={{ flexDirection:"row", marginVertical:6 }}>
        <Pressable onPress={addFake} style={btn}><Text style={{color:"white"}}>Örnek Ekle</Text></Pressable>
        <Pressable onPress={check} style={btn}><Text style={{color:"white"}}>Bütünlük Test</Text></Pressable>
        <Pressable onPress={send} style={btn}><Text style={{color:"white"}}>Sim. Gönder</Text></Pressable>
        <Pressable onPress={refresh} style={btn}><Text style={{color:"white"}}>Yenile</Text></Pressable>
      </View>
      <View style={box}>
        {last.map((r:any)=>(
          <Text key={r.id} style={{ color:"white", marginBottom:4 }}>
            #{r.id.slice(-6)} {r.kind} • {r.sent? "✓": "…"} • {new Date(r.ts).toLocaleTimeString()}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}



