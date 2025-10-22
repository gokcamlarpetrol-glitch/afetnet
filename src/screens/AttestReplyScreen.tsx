import React, { useState, useMemo } from 'react';
import { Alert, View, Text } from 'react-native';
import { SafeBarcodeScanner } from '../ui/SafeBarcodeScanner';
import { makeAttest } from '../evidence/attest';
import QRCode from 'react-native-qrcode-svg';

export default function AttestReplyScreen(){
  const [reply,setReply] = useState<any>(null);
  const [mode,setMode] = useState<'scan'|'show'>('scan');

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return (globalThis as any).require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  async function onScan({ data }:any){
    try{
      const o = JSON.parse(data);
      if(o?.t!=='attest_request') {return;}
      const att = await makeAttest(o.packId, o.packSha);
      setReply({ v:1, t:'attest_reply', att });
      setMode('show');
    }catch{ Alert.alert('Hata','Geçersiz QR'); }
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a' }}>
      {mode==='scan' ? (
        BarcodeScannerComponent ? (
          <BarcodeScannerComponent onBarCodeScanned={onScan} style={{ flex:1 }}/>
        ) : (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ color:'white' }}>Barcode Scanner not available</Text>
          </View>
        )
      ) : (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text style={{ color:'white', fontSize:18, marginBottom:10 }}>Onay (QR)</Text>
          <QRCode value={JSON.stringify(reply)} size={240}/>
          <Text style={{ color:'#9ca3af', marginTop:10, textAlign:'center' }}>Karşı taraf bu QR'ı tarayıp onayı kaydedecek.</Text>
        </View>
      )}
    </View>
  );
}
