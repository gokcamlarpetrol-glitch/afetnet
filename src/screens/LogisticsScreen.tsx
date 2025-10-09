import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Alert } from "react-native";
import { LItem, LCategory, LMode } from "../logistics/types";
import { listLogistics, addLogistics } from "../logistics/store";
import { Task, TaskStatus } from "../tasks/types";
import { upsertTask } from "../tasks/store";
import { broadcastTask } from "../tasks/p2p";
import { getDeviceShortId } from "../p2p/bleCourier";
import { detectConflicts } from "../logistics/conflicts";
import { useRole } from "../state/roleStore";
import * as Location from "expo-location";
import { quantizeLatLng } from "../geo/coarse";

function makeId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function makeTaskId(){ return "task_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

const CATS: {key:LCategory; label:string}[] = [
  { key:"shelter", label:"ÇADIR/BARINMA" },
  { key:"water", label:"SU" },
  { key:"food", label:"YEMEK" },
  { key:"medicine", label:"İLAÇ" },
  { key:"equipment", label:"EKİPMAN" }
];

export default function LogisticsScreen(){
  const [cat,setCat]=useState<LCategory>("shelter");
  const [mode,setMode]=useState<LMode>("request");
  const [text,setText]=useState("");
  const [list,setList]=useState<LItem[]>([]);
  const role = useRole();

  async function load(){ setList(await listLogistics(cat, undefined)); }
  useEffect(()=>{ load(); },[cat]);

  async function add(){
    if(!text.trim()) {return;}
    let q:any={}; try{ const p=await Location.getLastKnownPositionAsync({}); if(p){ const qll=quantizeLatLng(p.coords.latitude,p.coords.longitude); q={ qlat:qll.lat, qlng:qll.lng }; } }catch{}
    const it: LItem = { id: makeId(), ts: Date.now(), cat, mode, text: text.trim().slice(0,180), ttlSec: 24*3600, ...q };
    await addLogistics(it); setText(""); await load();
    await detectConflicts();
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <View style={{ padding:12 }}>
        <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Lojistik Pano (Offline)</Text>
        <Text style={{ color:"#94a3b8" }}>Talep/Teklif — Çadır, Su, Yemek, İlaç, Ekipman</Text>
      </View>

      <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, paddingHorizontal:12 }}>
        {CATS.map(c=>(
          <Pressable key={c.key} onPress={()=>setCat(c.key)} style={{ backgroundColor: cat===c.key?"#2563eb":"#1f2937", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white", fontSize:12 }}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection:"row", gap:8, padding:12 }}>
        <Pressable onPress={()=>setMode("request")} style={{ backgroundColor: mode==="request"?"#ef4444":"#1f2937", padding:8, borderRadius:8 }}>
          <Text style={{ color:"white" }}>TALEP</Text>
        </Pressable>
        <Pressable onPress={()=>setMode("offer")} style={{ backgroundColor: mode==="offer"?"#10b981":"#1f2937", padding:8, borderRadius:8 }}>
          <Text style={{ color:"white" }}>TEKLİF</Text>
        </Pressable>
        <TextInput placeholder="Kısa açıklama (180)" placeholderTextColor="#94a3b8"
          value={text} onChangeText={setText}
          style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <Pressable onPress={add} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8 }}>
          <Text style={{ color:"white" }}>Ekle</Text>
        </Pressable>
      </View>

      <FlatList
        data={list}
        keyExtractor={i=>i.id}
        renderItem={({item})=>(
          <View style={{ padding:10, borderBottomWidth:1, borderColor:"#111827" }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.mode==="request"?"TALEP":"TEKLİF"} — {CATS.find(c=>c.key===item.cat)?.label}</Text>
            <Text style={{ color:"white" }}>{item.text}</Text>
            {typeof item.qlat==="number" && <Text style={{ color:"#93c5fd", fontSize:10 }}>~ konum mevcut</Text>}
            <Text style={{ color:"#9ca3af", fontSize:10 }}>{new Date(item.ts).toLocaleString()}</Text>

            {/* Task actions */}
            {role.role!=="volunteer" && (
              <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
                <Pressable onPress={async()=>{
                  const me = await getDeviceShortId?.() || "me";
                  const t: Task = { id: makeTaskId(), rev:1, ts: Date.now(), itemId: item.id, assignee: me, status:"assigned" };
                  await upsertTask(t); await broadcastTask(t); Alert.alert("Görev atandı");
                }} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>BANA ATA</Text>
                </Pressable>

                <Pressable onPress={async()=>{
                  const me = await getDeviceShortId?.() || "me";
                  const t: Task = { id: makeTaskId(), rev:1, ts: Date.now(), itemId: item.id, assignee: me, status:"in_progress" };
                  await upsertTask(t); await broadcastTask(t); Alert.alert("Çalışılıyor");
                }} style={{ backgroundColor:"#f59e0b", padding:8, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>BAŞLAT</Text>
                </Pressable>

                <Pressable onPress={async()=>{
                  const me = await getDeviceShortId?.() || "me";
                  const t: Task = { id: makeTaskId(), rev:1, ts: Date.now(), itemId: item.id, assignee: me, status:"done" };
                  await upsertTask(t); await broadcastTask(t); Alert.alert("Tamamlandı");
                }} style={{ backgroundColor:"#10b981", padding:8, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>BİTTİ</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}
