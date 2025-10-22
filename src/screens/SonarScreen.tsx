import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { startPing, stopPing } from '../sonar/ping';
import { startListen, stopListen } from '../sonar/listen';
import * as FileSystem from 'expo-file-system';

export default function SonarScreen(){
  const [rx,setRx]=useState<any[]>([]);
  async function load(){
    try{
      const path = '/tmp/sonar.pings.json';
      const ex = await FileSystem.getInfoAsync(path);
      if(!ex.exists){ setRx([]); return; }
      const arr = JSON.parse(await FileSystem.readAsStringAsync(path));
      setRx(arr.slice(-50).reverse());
    }catch{ setRx([]); }
  }
  useEffect(()=>{ const t=(globalThis as any).setInterval(load,2000); load(); return ()=>(globalThis as any).clearInterval(t); },[]);
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontWeight:'800', fontSize:20 }}>Enkaz Yakınlık (Ses Ping)</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
        <Pressable onPress={()=>startPing()} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8 }}><Text style={{ color:'white' }}>PİNG BAŞLAT</Text></Pressable>
        <Pressable onPress={()=>stopPing()} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:8 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
        <Pressable onPress={()=>startListen()} style={{ backgroundColor:'#10b981', padding:10, borderRadius:8 }}><Text style={{ color:'white' }}>DİNLE</Text></Pressable>
        <Pressable onPress={()=>stopListen()} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:8 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
      </View>
      <View style={{ marginTop:12 }}>
        {rx.map((r,i)=>(
          <View key={i} style={{ backgroundColor:'#111827', padding:8, borderRadius:8, marginBottom:6 }}>
            <Text style={{ color:'#e5e7eb' }}>{new Date(r.ts).toLocaleTimeString()} • {r.kind.toUpperCase()} • slot {r.slot}</Text>
            <Text style={{ color:'#93c5fd', fontSize:12 }}>strength {r.strength?.toFixed?.(2)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color:'#94a3b8', fontSize:12, marginTop:8 }}>Not: Android'de metering sınırlı; dinleme doğruluğu düşebilir. BLE yakınlığı ile birlikte kullanın.</Text>
    </View>
  );
}



