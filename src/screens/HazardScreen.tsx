import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { inferHazards, listDrafts } from "../hazard/infer";
import { listHazards, removeHazard, upsertHazard } from "../hazard/store";
import { HazardType, HazardZone } from "../hazard/types";

function makeId(){ return "hz_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

export default function HazardScreen(){
  const [list,setList]=useState<HazardZone[]>([]);
  const [t,setT]=useState<HazardType>("collapse");
  const [sev,setSev]=useState<1|2|3>(2);
  const [radius,setRadius]=useState("120");
  const [note,setNote]=useState("");
  const [drafts,setDrafts]=useState<any[]>([]);

  async function reload(){ 
    setList(await listHazards()); 
    setDrafts(await listDrafts());
    await inferHazards(); // trigger inference
    setDrafts(await listDrafts()); // refresh drafts
  }
  useEffect(()=>{ reload(); },[]);

  async function add(){
    try{
      const p = await Location.getLastKnownPositionAsync({});
      if(!p){ Alert.alert("Konum","Bulunamadı"); return; }
      const z: HazardZone = {
        id: makeId(), t, severity: sev, radius: Math.max(30, Math.min(1000, parseInt(radius||"120",10))),
        center: { lat: p.coords.latitude, lng: p.coords.longitude },
        ts: Date.now(), note: note.trim()||undefined
      };
      await upsertHazard(z); setNote(""); await reload();
    }catch{ Alert.alert("Hata","Eklenemedi"); }
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Tehlike Bölgeleri</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:10, flexWrap:"wrap" }}>
        {(["aftershock","collapse","gas","flood","other"] as HazardType[]).map(x=>
          <Pressable key={x} onPress={()=>setT(x)} style={{ backgroundColor: t===x?"#ef4444":"#1f2937", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white" }}>{x.toUpperCase()}</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
        {([1,2,3] as (1|2|3)[]).map(s=>
          <Pressable key={s} onPress={()=>setSev(s)} style={{ backgroundColor: sev===s?"#f59e0b":"#1f2937", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white" }}>Seviye {s}</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
        <TextInput placeholder="Yarıçap (m)" placeholderTextColor="#94a3b8" value={radius} onChangeText={setRadius}
          style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <TextInput placeholder="Not (opsiyonel)" placeholderTextColor="#94a3b8" value={note} onChangeText={setNote}
          style={{ flex:2, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <Pressable onPress={add} style={{ backgroundColor:"#ef4444", padding:8, borderRadius:8 }}>
          <Text style={{ color:"white" }}>Ekle</Text>
        </Pressable>
      </View>

      <View style={{ marginTop:12 }}>
        {list.map(z=>(
          <View key={z.id} style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{z.t.toUpperCase()} • Sev.{z.severity} • {z.radius}m</Text>
            {z.note && <Text style={{ color:"#cbd5e1" }}>{z.note}</Text>}
            <Pressable onPress={async()=>{ await removeHazard(z.id); await reload(); }} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8, marginTop:8 }}>
              <Text style={{ color:"white", textAlign:"center" }}>Sil</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ marginTop:16 }}>
        <Text style={{ color:"#e5e7eb", fontWeight:"700", marginBottom:6 }}>Taslak Öneriler</Text>
        {drafts.length===0 ? <Text style={{ color:"#94a3b8" }}>Taslak yok. (İpuçları SOS/lojistik yoğunluğundan çıkarılır)</Text> :
          drafts.map(d=>(
            <View key={d.id} style={{ backgroundColor:"#0b1220", padding:10, borderRadius:10, marginBottom:8 }}>
              <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{String(d.t).toUpperCase()} • Sev.{d.severity} • {d.radius}m</Text>
              <Text style={{ color:"#93c5fd", fontSize:12 }}>~ öneri</Text>
              <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
                <Pressable onPress={async()=>{ await upsertHazard({ ...d, draft: undefined }); (globalThis as any).alert("Taslak kaydedildi"); await reload(); }} style={{ backgroundColor:"#10b981", padding:8, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>KAYDET</Text>
                </Pressable>
              </View>
            </View>
          ))
        }
      </View>
    </View>
  );
}
