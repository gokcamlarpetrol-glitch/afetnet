import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { startWhisper, stopWhisper, pulseHaptic } from '../guidance/whisperNav';

export default function WhisperNavScreen(){
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Fısıltı Yönlendirme</Text>
      <Text style={{ color:'#94a3b8', fontSize:12, marginTop:6, textAlign:'center' }}>Düşük sesli işitsel ipucu + dokunsal uyarı. Enkazda panik yaratmadan yönlendirme.</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
        <Pressable onPress={()=>startWhisper('low')} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>LOW</Text></Pressable>
        <Pressable onPress={()=>startWhisper('mid')} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>MID</Text></Pressable>
        <Pressable onPress={()=>startWhisper('high')} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>HIGH</Text></Pressable>
        <Pressable onPress={stopWhisper} style={{ backgroundColor:'#ef4444', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
      </View>
      <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
        <Pressable onPress={()=>pulseHaptic('slow')} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>HAPTIC SLOW</Text></Pressable>
        <Pressable onPress={()=>pulseHaptic('fast')} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>HAPTIC FAST</Text></Pressable>
      </View>
    </View>
  );
}



