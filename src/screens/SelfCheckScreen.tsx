import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SelfCheck, addSelf, listSelf } from "../health/selfcheck";
import { broadcastTicket } from "../help/mesh";
import { makeId, now } from "../relief/util";

export default function SelfCheckScreen(){
  const [avpu,setAvpu]=useState<SelfCheck["avpu"]>("A");
  const [bleed,setBleed]=useState(false);
  const [breath,setBreath]=useState(false);
  const [pain,setPain]=useState(false);
  const [imm,setImm]=useState(false);
  const [rows,setRows]=useState<SelfCheck[]>([]);

  async function refresh(){ setRows(await listSelf()); }
  useEffect(()=>{ refresh(); },[]);

  async function submit(){
    const c: SelfCheck = { id: "sc_"+makeId(""), ts: now(), avpu, bleed, breathDiff:breath, severePain:pain, immobile:imm };
    await addSelf(c);
    // optional: auto help
    const red = (avpu!=="A") || bleed || breath || imm;
    if(red){ await broadcastTicket({ id: makeId("h"), ts: now(), kind:"medical", title:"Self-Check: Kritik", detail:`AVPU=${avpu} bleed=${bleed} breath=${breath} imm=${imm}`, prio:"life", status:"new" }); }
    Alert.alert("Kaydedildi", red? "Durum kritik; yardım talebi yayınlandı." : "Durum kaydedildi.");
    refresh();
  }

  function pill(label:string, on:boolean, set:(v:boolean)=>void){
    return <Pressable onPress={()=>set(!on)} style={{ backgroundColor: on? "#ef4444":"#1f2937", padding:8, borderRadius:999 }}><Text style={{ color:"white" }}>{label}</Text></Pressable>;
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Hızlı Sağlık Testi</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap" }}>
        {(["A","V","P","U"] as SelfCheck["avpu"][]).map(x=>(
          <Pressable key={x} onPress={()=>setAvpu(x)} style={{ backgroundColor: avpu===x? "#2563eb":"#1f2937", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white" }}>AVPU: {x}</Text>
          </Pressable>
        ))}
        {pill("Kanama", bleed, setBleed)}
        {pill("Nefes Zorluğu", breath, setBreath)}
        {pill("Şiddetli Ağrı", pain, setPain)}
        {pill("Hareketsiz", imm, setImm)}
      </View>
      <Pressable onPress={submit} style={{ backgroundColor:"#10b981", padding:10, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>KAYDET</Text>
      </Pressable>

      <FlatList
        style={{ marginTop:10 }}
        data={rows.slice().reverse()}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{new Date(item.ts).toLocaleString()} • AVPU={item.avpu}</Text>
            <Text style={{ color:"#93c5fd" }}>bleed:{String(item.bleed)} breath:{String(item.breathDiff)} pain:{String(item.severePain)} imm:{String(item.immobile)}</Text>
          </View>
        )}
      />
    </View>
  );
}