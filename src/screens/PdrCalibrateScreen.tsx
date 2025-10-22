import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import * as PDR from '../pdr/pdr';

export default function PdrCalibrateScreen(){
  const [steps, setSteps] = useState('20');
  const [distance, setDistance] = useState('14'); // meters (ör. 20 adım ~ 14m)
  const [heading, setHeading] = useState('0'); // deg offset correction

  function apply(){
    const s = Math.max(1, parseInt(steps||'0',10));
    const d = Math.max(1, parseFloat(distance||'0'));
    const stride = d / s;
    // @ts-ignore
    PDR.state().stride = stride;
    // @ts-ignore
    PDR.state().heading = (PDR.state().heading + parseFloat(heading||'0')) % 360;
    Alert.alert('PDR', `Adım boyu: ${stride.toFixed(2)} m, heading ofset uygulandı.`);
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>PDR Kalibrasyon</Text>
      <Text style={{ color:'#94a3b8', marginBottom:12 }}>Düz bir koridorda ölçülü mesafede yürüyün ve değerleri girin.</Text>
      <Text style={{ color:'#e5e7eb' }}>Atılan adım:</Text>
      <TextInput value={steps} onChangeText={setSteps} keyboardType="number-pad" style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10, marginBottom:8 }} />
      <Text style={{ color:'#e5e7eb' }}>Gerçek mesafe (m):</Text>
      <TextInput value={distance} onChangeText={setDistance} keyboardType="decimal-pad" style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10, marginBottom:8 }} />
      <Text style={{ color:'#e5e7eb' }}>Pusula ofset (°):</Text>
      <TextInput value={heading} onChangeText={setHeading} keyboardType="numeric" style={{ backgroundColor:'#111827', color:'white', padding:10, borderRadius:10, marginBottom:12 }} />
      <Pressable onPress={apply} style={{ backgroundColor:'#22c55e', padding:12, borderRadius:10 }}>
        <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>Uygula</Text>
      </Pressable>
    </View>
  );
}



