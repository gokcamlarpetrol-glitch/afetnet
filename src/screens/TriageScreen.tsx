import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Location from "expo-location";
import { quantizeLatLng } from "../geo/coarse";
import { Triage } from "../triage/types";
import { listTriage, upsertTriage } from "../triage/store";
import { p2pLocalSend } from "../p2p/send";

function makeId(){ return "tri_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

export default function TriageScreen(){
  const [list,setList]=useState<Triage[]>([]);
  const [sel,setSel]=useState<Triage|null>(null);
  async function load(){ setList(await listTriage()); }
  useEffect(()=>{ load(); },[]);

  async function newCard(cat:Triage["cat"]){
    const p = await Location.getLastKnownPositionAsync({}).catch(()=>null);
    const q = p? quantizeLatLng(p.coords.latitude, p.coords.longitude) : null;
    const t: Triage = { id: makeId(), ts: Date.now(), cat, qlat: q?.lat, qlng: q?.lng };
    await upsertTriage(t); setSel(t); await load();
  }
  async function save(){
    if(!sel) {return;}
    await upsertTriage(sel); await p2pLocalSend({ kind:"triage_notice", v:1, ts: Date.now(), triage: sel }); Alert.alert("Kaydedildi","P2P yayınlandı"); await load();
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Hızlı TRİAJ</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap" }}>
        {(["RED","YELLOW","GREEN","BLACK"] as const).map(c=>(
          <Pressable key={c} onPress={()=>newCard(c)} style={{ backgroundColor: c==="RED"?"#ef4444":c==="YELLOW"?"#f59e0b":c==="GREEN"?"#10b981":"#6b7280", padding:10, borderRadius:10 }}>
            <Text style={{ color:"white", fontWeight:"800" }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {sel && (
        <View style={{ backgroundColor:"#0b1220", padding:12, borderRadius:12, marginTop:12 }}>
          <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>Kart #{sel.id}</Text>
          <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
            <TextInput placeholder="Nabız" keyboardType="number-pad" placeholderTextColor="#94a3b8" defaultValue={sel.pulse?String(sel.pulse):""} onChangeText={(v)=>setSel(s=>({ ...(s as any), pulse: parseInt(v||"0",10)||undefined }))} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
            <TextInput placeholder="Solunum" keyboardType="number-pad" placeholderTextColor="#94a3b8" defaultValue={sel.resp?String(sel.resp):""} onChangeText={(v)=>setSel(s=>({ ...(s as any), resp: parseInt(v||"0",10)||undefined }))} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          </View>
          <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
            <Pressable onPress={()=>setSel(s=>({ ...(s as any), conscious: !(s as any)?.conscious }))} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8 }}>
              <Text style={{ color:"white" }}>{sel.conscious? "Bilinç: VAR":"Bilinç: YOK"}</Text>
            </Pressable>
          </View>
          <TextInput placeholder="Not" placeholderTextColor="#94a3b8" defaultValue={sel.note||""} onChangeText={(v)=>setSel(s=>({ ...(s as any), note: v }))} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:8 }}/>
          <View style={{ alignItems:"center", marginTop:10 }}>
            <QRCode value={JSON.stringify(sel)} size={180}/>
          </View>
          <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
            <Pressable onPress={save} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>KAYDET & YAYINLA</Text></Pressable>
          </View>
        </View>
      )}

      <Text style={{ color:"#e5e7eb", fontWeight:"700", marginTop:12 }}>Kartlar</Text>
      <FlatList
        data={list.slice().reverse()}
        keyExtractor={x=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginTop:8 }}>
            <Text style={{ color:"white", fontWeight:"700" }}>{item.cat} — {new Date(item.ts).toLocaleString()}</Text>
            <Text style={{ color:"#94a3b8", fontSize:12 }}>{item.note||""}</Text>
          </View>
        )}
      />
    </View>
  );
}



