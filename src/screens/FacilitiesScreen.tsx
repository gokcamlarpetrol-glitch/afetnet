import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Facility, FacilityKind } from "../relief/types";
import { loadFacilities, saveFacilities, searchFacilities } from "../relief/store";

export default function FacilitiesScreen(){
  const [all,setAll]=useState<Facility[]>([]);
  const [q,setQ]=useState(""); const [kinds,setKinds]=useState<FacilityKind[]|null>(null);
  const [rows,setRows]=useState<Facility[]>([]);

  useEffect(()=>{ (async()=>{ const a=await loadFacilities(); setAll(a); setRows(a); })(); },[]);
  function apply(){ setRows(searchFacilities(all,q,kinds)); }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Barınak & Sağlık Noktaları</Text>
      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:12, marginTop:8 }}>
        <TextInput placeholder="Ara (isim/not)" placeholderTextColor="#94a3b8" value={q} onChangeText={setQ} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
        <View style={{ flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap" }}>
          {(["shelter","clinic","pharmacy","food","water"] as FacilityKind[]).map(k=>(
            <Pressable key={k} onPress={()=> setKinds(v=> !v? [k] : (v.includes(k)? v.filter(x=>x!==k) : [...v,k]))} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8 }}>
              <Text style={{ color:"white" }}>{k}</Text>
            </Pressable>
          ))}
          <Pressable onPress={apply} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white" }}>FİLTRELE</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.name}</Text>
            <Text style={{ color:"#93c5fd", fontSize:12 }}>{item.kind} {item.capacity? `• Kapasite ${item.capacity}`:""} {item.open? `• ${item.open}`:""}</Text>
            {!!item.note && <Text style={{ color:"#cbd5e1", fontSize:12, marginTop:4 }}>{item.note}</Text>}
          </View>
        )}
      />
    </View>
  );
}



