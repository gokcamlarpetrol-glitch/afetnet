import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getPreKeyBundle } from '../crypto/e2ee/identity';

export default function E2EESetupShow(){
  const [val,setVal] = useState<string>('');
  useEffect(()=>{ (async()=>{ const b = await getPreKeyBundle(); setVal(JSON.stringify(b)); })(); },[]);
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:'white', fontSize:18, marginBottom:10 }}>E2EE PreKey (QR)</Text>
      {val? <QRCode value={val} size={240}/> : <Text style={{ color:'#94a3b8' }}>Hazırlanıyor…</Text>}
    </View>
  );
}



