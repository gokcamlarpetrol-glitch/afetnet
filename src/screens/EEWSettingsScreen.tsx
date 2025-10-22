import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { setEEWFeedConfig, startEEW, stopEEW } from '../eew/feed';
import { EEWAlert } from '../eew/types';
import { pushEEW, listEEW } from '../eew/store';
import { startLocalPwave, stopLocalPwave } from '../eew/localPwave';

export default function EEWSettingsScreen(){
  const [ws,setWs]=useState('');
  const [poll,setPoll]=useState('');
  const [ival,setIval]=useState('30');

  function apply(){
    const wsArr = ws.split(',').map(s=>s.trim()).filter(Boolean);
    const pollArr = poll.split(',').map(s=>s.trim()).filter(Boolean);
    setEEWFeedConfig({ WS_URLS: wsArr, POLL_URLS: pollArr, POLL_INTERVAL_SEC: parseInt(ival||'30',10) });
    Alert.alert('Kaydedildi','EEW kaynakları güncellendi');
  }

  async function simulate(){
    const now=Date.now();
    const a: EEWAlert = { id:'SIM_'+now, ts:now, lat:39, lng:34, mag:5.8, depth:10, src:'SIM' };
    await pushEEW(a); Alert.alert('Simüle edildi','Son uyarılar ekranından görebilirsin.');
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Erken Uyarı Ayarları</Text>
      <Text style={{ color:'#93c5fd', marginTop:6 }}>WS ve REST kaynaklarını virgülle gir (kurumsal beslemeler için).</Text>
      <TextInput placeholder="WS URL'ler (virgüllü)" placeholderTextColor="#94a3b8" value={ws} onChangeText={setWs} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8 }}/>
      <TextInput placeholder="REST URL'ler (virgüllü)" placeholderTextColor="#94a3b8" value={poll} onChangeText={setPoll} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8 }}/>
      <TextInput placeholder="Tarama süresi (sn)" keyboardType="number-pad" placeholderTextColor="#94a3b8" value={ival} onChangeText={setIval} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8, width:140 }}/>
      <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
        <Pressable onPress={apply} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>Uygula</Text></Pressable>
        <Pressable onPress={startEEW} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>ONLINE EEW AÇ</Text></Pressable>
        <Pressable onPress={stopEEW} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>ONLINE EEW KAPAT</Text></Pressable>
        <Pressable onPress={startLocalPwave} style={{ backgroundColor:'#10b981', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>LOKAL P-DALGA AÇ</Text></Pressable>
        <Pressable onPress={stopLocalPwave} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>LOKAL P-DALGA KAPAT</Text></Pressable>
        <Pressable onPress={simulate} style={{ backgroundColor:'#f59e0b', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>SİMÜLASYON</Text></Pressable>
      </View>
      <Text style={{ color:'#94a3b8', fontSize:12, marginTop:10 }}>
        Not: EEW beslemeleri kurum politikalarına tabidir. Bu modül deneysel olup resmi uyarıların yerine geçmez.
      </Text>
    </ScrollView>
  );
}



