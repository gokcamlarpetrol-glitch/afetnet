import React from "react";
import { Pressable, Text, View } from "react-native";
import { recordVoice, stopVoice } from "../voiceNote/voice";

export default function VoiceNoteScreen(){
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Voice Notes</Text>
      <Pressable onPress={()=>recordVoice("a")} style={{ backgroundColor:"#2563eb", padding:14, borderRadius:10, marginTop:12 }}>
        <Text style={{ color:"white" }}>Kayıt Başlat</Text>
      </Pressable>
      <Pressable onPress={stopVoice} style={{ backgroundColor:"#ef4444", padding:14, borderRadius:10, marginTop:12 }}>
        <Text style={{ color:"white" }}>Durdur & Gönder</Text>
      </Pressable>
    </View>
  );
}



