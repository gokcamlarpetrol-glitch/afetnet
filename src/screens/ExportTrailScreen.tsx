import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { exportGeoJSON, exportGPX } from '../export/geo';

export default function ExportTrailScreen(){
  const [hours, setHours] = useState('2');
  async function doGeo(){ const dur = Math.max(1, parseInt(hours||'2',10)); const t1=Date.now(), t0=t1-dur*3600*1000; const p = await exportGeoJSON(t0,t1); Alert.alert('GeoJSON', 'Hazır: '+p); }
  async function doGpx(){ const dur = Math.max(1, parseInt(hours||'2',10)); const t1=Date.now(), t0=t1-dur*3600*1000; const p = await exportGPX(t0,t1); Alert.alert('GPX', 'Hazır: '+p); }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontWeight:'800', fontSize:20 }}>İz Dışa Aktarım (GeoJSON/GPX)</Text>
      <Text style={{ color:'#e5e7eb', marginTop:8 }}>Saat aralığı:</Text>
      <TextInput value={hours} onChangeText={setHours} keyboardType="number-pad" style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10, marginBottom:10 }} />
      <View style={{ flexDirection:'row', gap:8 }}>
        <Btn title="GeoJSON" onPress={doGeo}/>
        <Btn title="GPX" onPress={doGpx}/>
      </View>
    </View>
  );
}
function Btn({ title,onPress }:{title:string; onPress:()=>void}){
  return <Pressable onPress={onPress} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
    <Text style={{ color:'white', fontWeight:'800' }}>{title}</Text>
  </Pressable>;
}



