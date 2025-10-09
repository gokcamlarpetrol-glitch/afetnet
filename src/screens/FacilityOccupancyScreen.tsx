import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Facility } from "../relief/types";
import { loadFacilities } from "../relief/store";
import { getOcc, setOccupancy } from "../relief/occupancy";

export default function FacilityOccupancyScreen(){
  const [rows,setRows]=useState<(Facility & {occ:number})[]>([]);

  async function refresh(){
    const all = await loadFacilities();
    const out: (Facility & {occ:number})[] = [];
    for(const f of all){
      const o = await getOcc(f.id);
      out.push({ ...f, occ:o });
    }
    setRows(out.filter(x=>x.kind==="shelter").sort((a,b)=> (b.occ-a.occ)));
  }
  useEffect(()=>{ refresh(); const t=setInterval(refresh,4000); return ()=>clearInterval(t); },[]);

  async function setOcc(id:string, v:string){ const val = Math.max(0, Math.min(1, parseFloat(v||"0"))); await setOccupancy(id, val); refresh(); }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Barınak Doluluk</Text>
      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.name}</Text>
            <Text style={{ color:item.occ>0.8?"#ef4444": item.occ>0.5?"#f59e0b":"#10b981" }}>Doluluk: {(item.occ*100).toFixed(0)}%</Text>
            <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
              {["0.25","0.5","0.75","0.9"].map(v=>(
                <Pressable key={v} onPress={()=>setOcc(item.id, v)} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>{Number(v)*100}%</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Not: Bu bir topluluk tahminidir; resmi kapasite değildir.</Text>
    </View>
  );
}



