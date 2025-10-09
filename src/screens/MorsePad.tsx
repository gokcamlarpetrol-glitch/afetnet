import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { encodeULB } from "../ulb/codec";
import { broadcastULB } from "../ulb/p2p";

export default function MorsePad(){
  const [seq,setSeq]=useState<string>("");
  const [out,setOut]=useState<string>("");

  const table: Record<string,string> = {
    ".-":"A","-...":"B","-.-.":"C","-..":"D",".":"E","..-.":"F","--.":"G","....":"H","..":"I",".---":"J","-.-":"K",".-..":"L","--":"M","-.":"N","---":"O",".--.":"P","--.-":"Q",".-.":"R","...":"S","-":"T","..-":"U","...-":"V",".--":"W","-..-":"X","-.--":"Y","--..":"Z",
    "-----":"0",".----":"1","..---":"2","...--":"3","....-":"4",".....":"5","-....":"6","--...":"7","---..":"8","----.":"9"
  };

  function commit(){
    const ch = table[seq] || "?";
    setOut(o=>o+ch);
    setSeq("");
  }

  async function send(){
    const enc = await encodeULB(out);
    await broadcastULB(enc);
    setOut("");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12, alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Morse / Tap Klavye</Text>
      <Text style={{ color:"#93c5fd", marginTop:8 }}>Geçerli: {seq || "—"}</Text>
      <Text style={{ color:"#e5e7eb", marginTop:8 }}>Metin: {out || "—"}</Text>
      <View style={{ flexDirection:"row", gap:8, marginTop:12 }}>
        <Pressable onPress={()=>setSeq(s=>s+".")} style={{ backgroundColor:"#1f2937", padding:14, borderRadius:10 }}><Text style={{ color:"white" }}>•</Text></Pressable>
        <Pressable onPress={()=>setSeq(s=>s+"-")} style={{ backgroundColor:"#1f2937", padding:14, borderRadius:10 }}><Text style={{ color:"white" }}>—</Text></Pressable>
        <Pressable onPress={commit} style={{ backgroundColor:"#2563eb", padding:14, borderRadius:10 }}><Text style={{ color:"white" }}>HARF</Text></Pressable>
        <Pressable onPress={()=>setOut(o=>o+" ")} style={{ backgroundColor:"#1f2937", padding:14, borderRadius:10 }}><Text style={{ color:"white" }}>BOŞLUK</Text></Pressable>
        <Pressable onPress={send} style={{ backgroundColor:"#10b981", padding:14, borderRadius:10 }}><Text style={{ color:"white" }}>GÖNDER</Text></Pressable>
      </View>
    </View>
  );
}



