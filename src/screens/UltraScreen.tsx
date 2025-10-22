import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { startUltraTx, stopUltraTx, isUltraTxOn } from '../assist/ultraTx';
import { startUltraRx, stopUltraRx, isUltraRxOn } from '../assist/ultraRx';

export default function UltraScreen(){
  const [tx, setTx] = useState(false);
  const [rx, setRx] = useState(false);
  const [lvl, setLvl] = useState(0);

  async function toggleTx(){ try{ if (isUltraTxOn()){ await stopUltraTx(); setTx(false); } else { await startUltraTx(); setTx(true); } }catch{ Alert.alert('Ultrasonik','TX açılamadı'); } }
  async function toggleRx(){ try{ if (isUltraRxOn()){ await stopUltraRx(); setRx(false); } else { await startUltraRx(setLvl); setRx(true); } }catch{ Alert.alert('Ultrasonik','RX açılamadı'); } }

  const txt = lvl>0.65 ? 'Yakın' : lvl>0.35 ? 'Orta' : 'Uzak';

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Ultrasonik Yakınlık</Text>
      <Text style={{ color:'#94a3b8', marginBottom:10 }}>TX 19kHz darbeler • RX seviyeye göre yakınlık</Text>
      <View style={{ flexDirection:'row', gap:8 }}>
        <Btn title={tx?'TX Durdur':'TX Başlat'} onPress={toggleTx}/>
        <Btn title={rx?'RX Durdur':'RX Başlat'} onPress={toggleRx}/>
      </View>
      <View style={{ marginTop:16, backgroundColor:'#111827', padding:14, borderRadius:12 }}>
        <Text style={{ color:'#e5e7eb' }}>Seviye: {(lvl*100|0)}%</Text>
        <Text style={{ color:'#22c55e', fontWeight:'800', fontSize:18 }}>{txt}</Text>
        <Text style={{ color:'#64748b', fontSize:12, marginTop:6 }}>Not: Telefonlar arası donanım farkları → yalnızca yakın/orta/uzak göstergesi kullanın.</Text>
      </View>
    </View>
  );
}
function Btn({ title,onPress }:{title:string;onPress:()=>void}){
  return <Pressable onPress={onPress} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
    <Text style={{ color:'white', fontWeight:'800' }}>{title}</Text>
  </Pressable>;
}



