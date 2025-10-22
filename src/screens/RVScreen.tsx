import React, { useState } from 'react';
import { Alert, View, Text, TextInput, Pressable } from 'react-native';
import { makeRV, threadFromRV } from '../rv/rv';

export default function RVScreen({ onReady }:{ onReady?:(rv:string, threadId:string)=>void }){
  const [rv] = useState(makeRV());
  const [peerRV,setPeerRV]=useState('');

  async function start(){
    const th = await threadFromRV(rv);
    onReady?.(rv, th);
  }
  async function join(){
    if(!peerRV.trim()) { Alert.alert('Kod','Geçersiz'); return; }
    const th = await threadFromRV(peerRV.trim().toUpperCase());
    onReady?.(peerRV.trim().toUpperCase(), th);
  }

  return (
    <View style={{ padding:14 }}>
      <Text style={{ color:'white', fontSize:18, fontWeight:'700' }}>Randevu Kodu (RV)</Text>
      <Text style={{ color:'#94a3b8', marginVertical:6 }}>Bu kod, enkaz içi ↔ dışı sohbeti bağlamak için kullanılır (şebekesiz).</Text>
      <Text style={{ color:'#e5e7eb' }}>Senin Kodun: <Text style={{ fontWeight:'800' }}>{rv}</Text></Text>
      <Pressable onPress={start} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:'white', textAlign:'center' }}>Sohbet Başlat</Text>
      </Pressable>
      <View style={{ height:10 }}/>
      <TextInput placeholder="Karşı tarafın RV kodu" placeholderTextColor="#94a3b8" value={peerRV} onChangeText={setPeerRV}
        style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10 }}/>
      <Pressable onPress={join} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:'white', textAlign:'center' }}>Sohbete Katıl</Text>
      </Pressable>
    </View>
  );
}



