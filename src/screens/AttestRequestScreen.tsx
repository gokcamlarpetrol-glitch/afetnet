import React, { useEffect, useState } from 'react';
import { Alert, View, Text, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import { EV_DIR } from '../evidence/paths';

type Req = { v:1; t:'attest_request'; packId:string; packSha:string };

export default function AttestRequestScreen(){
  const [req,setReq] = useState<Req|null>(null);
  useEffect(()=>{ (async()=>{
    try{
      // pick latest pack from local evidence dir (simple heuristic)
      const entries = await FileSystem.readDirectoryAsync(EV_DIR);
      const packs = Array.from(new Set(entries.map(x=>x.split('_')[0]).filter(x=>x.startsWith('ev_'))));
      if(!packs.length){ Alert.alert('Paket yok','Önce kanıt paketi oluşturun'); return; }
      const id = packs.sort().pop()!;
      const sig = await FileSystem.readAsStringAsync(`${EV_DIR}${id}_signature.json`);
      const o = JSON.parse(sig);
      setReq({ v:1, t:'attest_request', packId: id, packSha: o.sha256 });
    }catch{ Alert.alert('Hata','İstek hazırlanamadı'); }
  })(); },[]);

  if(!req) {return <View style={{ flex:1,alignItems:'center',justifyContent:'center' }}><Text style={{ color:'#94a3b8' }}>Hazırlanıyor…</Text></View>;}
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:18, marginBottom:10 }}>Onay İsteği (QR)</Text>
      <QRCode value={JSON.stringify(req)} size={240}/>
      <Text style={{ color:'#9ca3af', marginTop:10, textAlign:'center' }}>Diğer cihaz bu QR'ı tarayıp "Onayla" yapacak; sonra oluşturduğu QR'ı siz tarayacaksınız.</Text>
    </View>
  );
}



