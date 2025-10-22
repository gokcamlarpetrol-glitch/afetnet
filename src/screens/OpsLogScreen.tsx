import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { exportOpsLog } from '../opslog/exporter';

export default function OpsLogScreen(){
  const [last,setLast]=useState<string>('');
  async function run(){
    const p = await exportOpsLog();
    setLast(p.split('/').pop()||'');
  }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Operasyon Günlüğü</Text>
      <Text style={{ color:'#94a3b8', marginVertical:8, textAlign:'center' }}>Mesaj/SOS/Evidence/Attest/Pano/Lojistik aktivitelerini JSON+CSV olarak dışa aktarır.</Text>
      <Pressable onPress={run} style={{ backgroundColor:'#2563eb', padding:12, borderRadius:10 }}>
        <Text style={{ color:'white', fontWeight:'800' }}>ZIP OLUŞTUR & PAYLAŞ</Text>
      </Pressable>
      {!!last && <Text style={{ color:'#93c5fd', marginTop:10, fontSize:12 }}>Son: {last}</Text>}
    </View>
  );
}



