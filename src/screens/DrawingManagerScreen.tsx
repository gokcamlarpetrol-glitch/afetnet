import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { DrawShape, DrawKind } from "../draw/types";
import { listShapes } from "../draw/store";
import { broadcastShape } from "../draw/mesh";
import { p2pLocalSend } from "../p2p/send";

export default function DrawingManagerScreen(){
  const [rows,setRows]=useState<DrawShape[]>([]);
  const [sel,setSel]=useState<DrawShape|null>(null);
  const [ttl,setTtl]=useState(""); const [note,setNote]=useState(""); const [kind,setKind]=useState<DrawKind>("rubble");

  async function refresh(){ setRows(await listShapes()); }
  useEffect(()=>{ refresh(); },[]);

  function pick(d:DrawShape){ setSel(d); setTtl(String(d.ttlSec||"")); setNote(d.note||""); setKind(d.kind); }

  async function save(){
    if(!sel) {return;}
    const s: DrawShape = { ...sel, ttlSec: ttl? parseInt(ttl,10): undefined, note, kind, ts: Date.now() };
    await broadcastShape(s); Alert.alert("Güncellendi","Çizim mesh'e yayınlandı"); refresh();
  }

  async function del(){
    if(!sel) {return;}
    await p2pLocalSend({ kind:"draw_del", v:1, id: sel.id, ts: Date.now() });
    Alert.alert("Silindi","Çizim kaldırıldı"); setSel(null); refresh();
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Çizim Yönetimi</Text>
      <FlatList
        style={{ marginTop:10 }}
        data={rows.slice().reverse()}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <Pressable onPress={()=>pick(item)} style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.kind} • {item.coords.length} nokta</Text>
            {!!item.note && <Text style={{ color:"#cbd5e1" }}>{item.note}</Text>}
          </Pressable>
        )}
      />
      {!!sel && (
        <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:12 }}>
          <Text style={{ color:"#94a3b8" }}>Seçili: {sel.id}</Text>
          <View style={{ flexDirection:"row", gap:8, marginTop:6, flexWrap:"wrap" }}>
            {(["rubble","flood","blocked","hazard","note"] as DrawKind[]).map(k=>(
              <Pressable key={k} onPress={()=>setKind(k)} style={{ backgroundColor: kind===k? "#2563eb":"#1f2937", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>{k}</Text></Pressable>
            ))}
          </View>
          <TextInput placeholder="TTL (sn)" placeholderTextColor="#94a3b8" value={ttl} onChangeText={setTtl} keyboardType="number-pad" style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:8 }}/>
          <TextInput placeholder="Not" placeholderTextColor="#94a3b8" value={note} onChangeText={setNote} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:6 }}/>
          <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
            <Pressable onPress={save} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>KAYDET</Text></Pressable>
            <Pressable onPress={del} style={{ backgroundColor:"#ef4444", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>SİL</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}



