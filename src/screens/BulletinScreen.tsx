import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Bulletin, makeId } from "../ops/types";
import { addBulletin, listBulletins } from "../ops/bulletinStore";
import { broadcastBulletin } from "../ops/bulletinMesh";

export default function BulletinScreen(){
  const [rows,setRows]=useState<Bulletin[]>([]);
  const [title,setTitle]=useState(""); const [body,setBody]=useState("");
  const [cat,setCat]=useState<Bulletin["cat"]>("general");
  const [prio,setPrio]=useState<Bulletin["prio"]>("med");
  const [ttl,setTtl]=useState("180");

  async function refresh(){ setRows((await listBulletins()).sort((a,b)=> weight(b)-weight(a))); }
  useEffect(()=>{ refresh(); const t=setInterval(refresh,3000); return ()=>clearInterval(t); },[]);

  function weight(b:Bulletin){ return (b.prio==="high"?3:b.prio==="med"?2:1) + (b.expires? 0: 0.5); }

  async function post(){
    const exp = parseInt(ttl||"0",10); const expires = exp>0? Date.now()+exp*1000 : undefined;
    const b: Bulletin = { id: makeId("blt"), title, body, cat, prio, expires, ts: Date.now() };
    await broadcastBulletin(b); setTitle(""); setBody(""); refresh(); Alert.alert("Gönderildi","Duyuru mesh'e yayınlandı");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Duyuru Panosu</Text>
      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:12, marginTop:8 }}>
        <TextInput placeholder="Başlık" placeholderTextColor="#94a3b8" value={title} onChangeText={setTitle} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <TextInput placeholder="İçerik" placeholderTextColor="#94a3b8" value={body} onChangeText={setBody} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:6 }}/>
        <View style={{ flexDirection:"row", gap:8, marginTop:6, flexWrap:"wrap" }}>
          {(["shelter","health","safety","logistics","general"] as Bulletin["cat"][]).map(c=>(
            <Pressable key={c} onPress={()=>setCat(c)} style={{ backgroundColor: cat===c? "#2563eb":"#1f2937", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>{c}</Text></Pressable>
          ))}
          {(["high","med","low"] as Bulletin["prio"][]).map(p=>(
            <Pressable key={p} onPress={()=>setPrio(p)} style={{ backgroundColor: prio===p? "#ef4444":"#1f2937", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>{p}</Text></Pressable>
          ))}
        </View>
        <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
          <TextInput placeholder="Süre (sn, 0=süre yok)" keyboardType="number-pad" placeholderTextColor="#94a3b8" value={ttl} onChangeText={setTtl} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          <Pressable onPress={post} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>YAYINLA</Text></Pressable>
        </View>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.title} • {item.cat}</Text>
            <Text style={{ color:item.prio==="high"?"#ef4444": item.prio==="med"?"#f59e0b":"#93c5fd" }}>
              {item.prio.toUpperCase()} {item.expires? `• ${Math.max(0, Math.round((item.expires - Date.now())/1000))} sn`:""}
            </Text>
            <Text style={{ color:"#cbd5e1", marginTop:4 }}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
}



