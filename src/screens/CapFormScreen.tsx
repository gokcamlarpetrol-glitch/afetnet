import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CapLite, CapCategory } from "../cap/schema";
import { saveCap, shareCap } from "../cap/serialize";
import { getDeviceId } from "../lib/device";
import * as Beacon from "../ble/bridge";
import { upsertPin } from "../map/pins";

const cats: CapCategory[] = ["Rescue","Medical","Fire","Weather","Infrastructure","Other"];
const urg = ["Immediate","Expected","Future","Past","Unknown"];
const cert = ["Observed","Likely","Possible","Unlikely","Unknown"];
const sev = ["Extreme","Severe","Moderate","Minor","Unknown"];

export default function CapFormScreen(){
  const [event, setEvent] = useState("");
  const [category, setCategory] = useState<CapCategory[]>(["Rescue"]);
  const [severity, setSeverity] = useState("Severe");
  const [urgency, setUrgency] = useState("Immediate");
  const [certainty, setCertainty] = useState("Observed");
  const [desc, setDesc] = useState("");
  const [contact, setContact] = useState("");
  const [geo, setGeo] = useState({ lat:"", lon:"", r:"" });

  async function onSave(){
    const id = "cap-"+Date.now();
    const sender = await getDeviceId();
    const cap: CapLite = {
      identifier: id,
      sender,
      sent: new Date().toISOString(),
      status: "Actual",
      msgType: "Alert",
      scope: "Public",
      info: {
        category, event,
        urgency: urgency as any, severity: severity as any, certainty: certainty as any,
        description: desc || undefined,
        contact: contact || undefined,
        area: (geo.lat && geo.lon) ? { lat: parseFloat(geo.lat), lon: parseFloat(geo.lon), radiusM: geo.r? parseFloat(geo.r): undefined } : undefined
      }
    };
    try{
      const path = await saveCap(cap);
      // Pin oluştur (geo girildiyse)
      if (cap.info.area?.lat!=null && cap.info.area?.lon!=null){
        await upsertPin({ id: cap.identifier, kind:"cap", title: cap.info.event, lat: cap.info.area.lat, lon: cap.info.area.lon, status: cap.info.severity, ref: cap.identifier, ts: Date.now() });
      }
      Alert.alert("CAP", "Kaydedildi: "+path);
    }catch(e:any){ Alert.alert("Hata", e?.message || "Kaydedilemedi"); }
  }

  async function broadcastSummary(){
    const text = `[CAP] ${event || "Olay"} • ${severity}/${urgency}/${certainty}`;
    try{ await Beacon.broadcastText(text); Alert.alert("Yayın", "Özet gönderildi"); }catch{}
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Olay Formu (CAP-lite)</Text>

      <Text style={{color:"#e5e7eb", marginTop:10}}>Olay / Özet</Text>
      <TextInput value={event} onChangeText={setEvent} placeholder="Örn. Enkaz altında yaralı" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />

      <Text style={{color:"#e5e7eb", marginTop:10}}>Kategori (virgülle ayır)</Text>
      <TextInput value={category.join(",")} onChangeText={(t)=>setCategory(t.split(",").map(s=>s.trim()).filter(Boolean) as any)} placeholder="Rescue, Medical" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />

      <View style={{flexDirection:"row", gap:8, marginTop:10}}>
        <Field label="Önem" value={severity} setValue={setSeverity} />
        <Field label="Aciliyet" value={urgency} setValue={setUrgency} />
        <Field label="Kesinlik" value={certainty} setValue={setCertainty} />
      </View>

      <Text style={{color:"#e5e7eb", marginTop:10}}>Açıklama</Text>
      <TextInput value={desc} onChangeText={setDesc} placeholder="Detaylar" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} multiline />

      <Text style={{color:"#e5e7eb", marginTop:10}}>İrtibat (ops.)</Text>
      <TextInput value={contact} onChangeText={setContact} placeholder="Ad/No" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />

      <Text style={{color:"#e5e7eb", marginTop:10}}>Konum (ops.)</Text>
      <View style={{flexDirection:"row", gap:8}}>
        <Field label="Lat" value={geo.lat} setValue={(v)=>setGeo({...geo, lat:v})}/>
        <Field label="Lon" value={geo.lon} setValue={(v)=>setGeo({...geo, lon:v})}/>
        <Field label="R(m)" value={geo.r}   setValue={(v)=>setGeo({...geo, r:v})}/>
      </View>

      <View style={{flexDirection:"row", gap:8, marginTop:14}}>
        <Btn title="Kaydet (JSON)" onPress={onSave}/>
        <Btn title="Özet Yayınla" onPress={broadcastSummary}/>
      </View>
    </ScrollView>
  );
}

function Field({label, value, setValue}:{label:string; value:string; setValue:(v:string)=>void}){
  return (
    <View style={{flex:1}}>
      <Text style={{color:"#e5e7eb"}}>{label}</Text>
      <TextInput value={value} onChangeText={setValue} placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
    </View>
  );
}

function Btn({title, onPress}:{title:string; onPress:()=>void}){
  return (
    <Pressable onPress={onPress} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
      <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>{title}</Text>
    </Pressable>
  );
}
