import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { loadPower, savePower } from '../power/profile';
import { startAudioDetect, stopAudioDetect } from '../audio/detect';

export default function PowerProfileScreen(){
  const [mesh,setMesh]=useState('30'); const [ulb,setUlb]=useState('10');
  const [audioOn,setAudioOn]=useState(false); const [dim,setDim]=useState(true);

  useEffect(()=>{ (async()=>{ const p=await loadPower(); setMesh(String(p.meshPingSec)); setUlb(String(p.ulbRateLimitSec)); setAudioOn(p.audioDetect); setDim(p.screenDimming); })(); },[]);

  async function apply(){
    const p = await savePower({ meshPingSec: parseInt(mesh||'30',10), ulbRateLimitSec: parseInt(ulb||'10',10), audioDetect: audioOn, screenDimming: dim });
    if(p.audioDetect) {await startAudioDetect();} else {await stopAudioDetect();}
    Alert.alert('Başarılı', 'Güç profili kaydedildi');
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Acil Güç Profili</Text>
      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:12, marginTop:8 }}>
        <View style={{ flexDirection:'row', gap:8 }}>
          <TextInput placeholder="Mesh Ping (sn)" keyboardType="number-pad" placeholderTextColor="#94a3b8" value={mesh} onChangeText={setMesh} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
          <TextInput placeholder="ULB rate-limit (sn)" keyboardType="number-pad" placeholderTextColor="#94a3b8" value={ulb} onChangeText={setUlb} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        </View>
        <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
          <Pressable onPress={()=>setAudioOn(v=>!v)} style={{ backgroundColor: audioOn? '#ef4444':'#1f2937', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>Ses Algılama {audioOn?'AÇIK':'KAPALI'}</Text>
          </Pressable>
          <Pressable onPress={()=>setDim(v=>!v)} style={{ backgroundColor: dim? '#2563eb':'#1f2937', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>Ekran Kısma {dim?'AÇIK':'KAPALI'}</Text>
          </Pressable>
          <Pressable onPress={apply} style={{ backgroundColor:'#10b981', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>UYGULA</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:8 }}>Not: Mesh ping ve ULB oranı, enerji tasarrufu için artırılabilir.</Text>
    </View>
  );
}



