import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { verifyZip, preview, applyPack, listApplied, rollbackLast } from "../datapack/store";

export default function DataPacksScreen(){
  const [list,setList]=useState<any[]>([]);
  const [prev,setPrev]=useState<any[]>([]);
  async function refresh(){ setList(await listApplied()); }
  React.useEffect(()=>{ refresh(); },[]);

  async function pick(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ type: "application/zip" });
      if(res.canceled) {return;}
      const file = res.assets[0];
      const buf = await fetch(file.uri).then(r=>r.arrayBuffer());
      const { zip, manifest } = await verifyZip(buf);
      const p = await preview(manifest);
      setPrev(p);
      Alert.alert("Paket", `Uygulanacak: ${p.length} dosya`, [
        { text:"İptal" }, 
        { text:"Uygula", onPress: async()=>{ const n=await applyPack(zip, manifest); setPrev([]); await refresh(); Alert.alert("Tamam", `${n} dosya uygulandı`); } }
      ]);
    }catch(e:any){ Alert.alert("Hata", e?.message || "Paket okunamadı"); }
  }

  async function rollback(){
    try{ await rollbackLast(); await refresh(); Alert.alert("Geri alındı","Son paket geri alındı"); }
    catch(e:any){ Alert.alert("Hata", e?.message || "Geri alma başarısız"); }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Güncelleme Paketleri (Offline)</Text>
      <Pressable onPress={pick} style={{ backgroundColor:"#2563eb", padding:12, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:"white", fontWeight:"800", textAlign:"center" }}>ZIP SEÇ & UYGULA</Text>
      </Pressable>
      <Pressable onPress={rollback} style={{ backgroundColor:"#1f2937", padding:12, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:"white", textAlign:"center" }}>Son Paketi Geri Al</Text>
      </Pressable>

      {prev.length>0 && (
        <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:10, marginTop:12 }}>
          <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>Önizleme</Text>
          {prev.map((x,i)=><Text key={i} style={{ color:"#cbd5e1", fontSize:12 }}>• {x.path}</Text>)}
        </View>
      )}

      <View style={{ marginTop:12 }}>
        <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>Uygulanan Paketler</Text>
        {list.length===0 ? <Text style={{ color:"#94a3b8" }}>Kayıt yok</Text> :
          list.map((a,i)=>(
            <View key={i} style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginTop:8 }}>
              <Text style={{ color:"white" }}>{a.packId} • v{a.version}</Text>
              <Text style={{ color:"#94a3b8", fontSize:12 }}>{new Date(a.ts).toLocaleString()}</Text>
              <Text style={{ color:"#93c5fd", fontSize:12 }}>{a.files?.length||0} dosya</Text>
            </View>
          ))
        }
      </View>
    </ScrollView>
  );
}



