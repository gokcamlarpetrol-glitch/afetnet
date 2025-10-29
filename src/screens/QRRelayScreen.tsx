import React, { useState, useMemo } from 'react';
import { Alert, View, Text, Pressable, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeBarcodeScanner } from '../ui/SafeBarcodeScanner';
import { listInbox, appendInbox } from '../msg/store';

export default function QRRelayScreen(){
  const [mode,setMode]=useState<'show'|'scan'>('show');
  const [msgs,setMsgs]=useState<any[]>([]);
  const [scanned, setScanned] = useState(false);

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable() && SafeBarcodeScanner.CameraView) {
      return SafeBarcodeScanner.CameraView;
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
          <BarcodeScannerComponent 
            onBarcodeScanned={scanned ? undefined : onScan}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_e', 'code39', 'code93', 'code128', 'pdf417', 'itf14', 'datamatrix', 'aztec'],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ color:'white' }}>Barcode Scanner not available</Text>
          </View>
        )
      )}
    </View>
  );
}
