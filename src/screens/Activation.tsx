import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { save, KEYS } from "../lib/secure";
export default function Activation({ onDone }: { onDone: ()=>void }){
  const [api,setApi]=useState("");
  const [sec,setSec]=useState("");
  const canSave = api.startsWith("http");
  async function submit(){
    if(!canSave) {return;}
    await save(KEYS.api, api.trim());
    if(sec) {await save(KEYS.secret, sec.trim());}
    onDone();
  }
  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:16, justifyContent:"center"}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:22, marginBottom:12}}>AfetNet Aktivasyon</Text>
      <Text style={{color:"#94a3b8"}}>Sunucu URL</Text>
      <TextInput value={api} onChangeText={setApi} placeholder="https://sunucu.tld/afetnet" placeholderTextColor="#6b7280"
        autoCapitalize="none"
        style={{backgroundColor:"#111827", color:"white", padding:12, borderRadius:10, marginBottom:12}} />
      <Text style={{color:"#94a3b8"}}>Gizli Anahtar (opsiyonel)</Text>
      <TextInput value={sec} onChangeText={setSec} placeholder="sadece yöneticiniz verirse" placeholderTextColor="#6b7280"
        secureTextEntry
        style={{backgroundColor:"#111827", color:"white", padding:12, borderRadius:10, marginBottom:16}} />
      <Pressable onPress={submit} disabled={!canSave}
        style={{backgroundColor: canSave ? "#22c55e" : "#334155", padding:12, borderRadius:10}}>
        <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Kaydet</Text>
      </Pressable>
    </View>
  );
}



