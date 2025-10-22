import React, { useEffect, useState } from 'react';
import { View, Text, Switch } from 'react-native';

export default function CarrierModeScreen(){
  const [on,setOn]=useState(false);
  useEffect(()=>{ if(on){ /* enable aggressive BLE scan+advert loop for msg bundles */ } },[on]);
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:'white', fontSize:18, fontWeight:'800' }}>Gönüllü Taşıyıcı Modu</Text>
      <Text style={{ color:'#94a3b8', marginTop:8, marginBottom:12 }}>Bu cihaz, diğerlerinin mesajlarını yakalayıp taşıyacak.</Text>
      <Switch value={on} onValueChange={setOn}/>
      {on && <Text style={{ color:'#22c55e', marginTop:8 }}>Aktif</Text>}
    </View>
  );
}



