import React, { useState, useMemo } from 'react';
import { Alert, View, Text, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeBarcodeScanner } from '../ui/SafeBarcodeScanner';
import { listInbox, appendInbox } from '../msg/store';

export default function QRRelayScreen(){
  const [mode,setMode]=useState<'show'|'scan'>('show');
  const [msgs,setMsgs]=useState<any[]>([]);

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  async function refresh(){
    const list = await listInbox(undefined,20);
    setMsgs(list.slice(-5)); // last 5 msgs
  }

  async function onScan({ data }:any){
    try{ const o=JSON.parse(data); await appendInbox(o); Alert.alert('Başarılı', 'Mesaj alındı'); }catch{
      // Ignore JSON parse errors
    }
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16 }}>
      <Text style={{ color:'white', fontWeight:'800', fontSize:18 }}>QR Relay</Text>
      <Pressable onPress={()=>setMode(mode==='show'?'scan':'show')} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:8, marginVertical:12 }}>
        <Text style={{ color:'white', textAlign:'center' }}>{mode==='show'?'Tara':'Göster'}</Text>
      </Pressable>
      {mode==='show' ? (
        <View style={{ alignItems:'center' }}>
          {msgs.map((m,i)=><QRCode key={i} value={JSON.stringify(m)} size={200}/>)}
          <Pressable onPress={refresh} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8, marginTop:12 }}>
            <Text style={{ color:'white' }}>Yenile</Text>
          </Pressable>
        </View>
      ) : (
        BarcodeScannerComponent ? (
          <BarcodeScannerComponent onBarCodeScanned={onScan} style={{ flex:1 }}/>
        ) : (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ color:'white' }}>Barcode Scanner not available</Text>
          </View>
        )
      )}
    </View>
  );
}
