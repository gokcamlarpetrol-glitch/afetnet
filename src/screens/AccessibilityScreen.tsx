import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { loadAccess, setAccess } from "../ui/access";

export default function AccessibilityScreen(){
  const [large,setLarge]=useState(false); const [high,setHigh]=useState(false);
  useEffect(()=>{ (async()=>{ const a=await loadAccess(); setLarge(a.large); setHigh(a.high); })(); },[]);
  async function save(){ const a=await setAccess({ large, high }); (globalThis as any).alert(`Kaydedildi: large=${a.large} high=${a.high}`); }
  return (
    <View style={{ flex:1, backgroundColor: high? "#000":"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize: large? 26:20, fontWeight:"800" }}>Erişilebilirlik</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={()=>setLarge(v=>!v)} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>Büyük Yazı: {large?"AÇIK":"KAPALI"}</Text></Pressable>
        <Pressable onPress={()=>setHigh(v=>!v)} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>Yüksek Kontrast: {high?"AÇIK":"KAPALI"}</Text></Pressable>
        <Pressable onPress={save} style={{ backgroundColor:"#10b981", padding:10, borderRadius:10 }}><Text style={{ color:"white" }}>Kaydet</Text></Pressable>
      </View>
    </View>
  );
}



