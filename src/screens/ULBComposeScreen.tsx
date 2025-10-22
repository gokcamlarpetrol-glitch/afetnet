import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { encodeULB } from '../ulb/codec';
import { broadcastULB } from '../ulb/p2p';

export default function ULBComposeScreen(){
  const [txt,setTxt]=useState('');
  async function send(){
    const enc = await encodeULB(txt);
    await broadcastULB(enc);
    setTxt('');
  }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>ULB Metin (çok düşük bant)</Text>
      <TextInput placeholder="Kısa mesaj" placeholderTextColor="#94a3b8" value={txt} onChangeText={setTxt} style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10, marginTop:10 }}/>
      <Pressable onPress={send} style={{ backgroundColor:'#2563eb', padding:12, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:'white', textAlign:'center', fontWeight:'800' }}>GÖNDER</Text>
      </Pressable>
    </View>
  );
}



