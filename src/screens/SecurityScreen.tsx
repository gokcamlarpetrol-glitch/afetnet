import React, { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import SvgQRCode from "react-native-qrcode-svg";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import { getOwn, addPeer } from "../security/keys";

export default function SecurityScreen(){
  const [pub, setPub] = useState<string>("");
  const [scan, setScan] = useState(false);

  useEffect(()=>{ getOwn().then(k=> setPub(k.publicKey)); },[]);

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  async function onScan({data}:any){
    try{
      const obj = JSON.parse(String(data));
      if (obj?.afetnet_key?.pub){
        await addPeer(obj.afetnet_key.pub, obj.afetnet_key.pub);
        Alert.alert("Anahtar", "Eş anahtarı eklendi");
      }
    }catch{}
    setScan(false);
  }

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:16}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Güvenlik / Anahtar Paylaşımı</Text>
      <Text style={{color:"#94a3b8", marginBottom:8}}>Aşağıdaki QR'ı yakındaki kişiye okutun veya siz onlarınkini tarayın.</Text>
      {pub ? <View style={{alignItems:"center", marginVertical:12}}>
        <SvgQRCode value={JSON.stringify({ afetnet_key: { pub }})} size={220}/>
      </View> : null}
      <Pressable onPress={()=>setScan(true)} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
        <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>ANAHTAR TARA</Text>
      </Pressable>
      {scan && (
        <View style={{flex:1, marginTop:12}}>
          {BarcodeScannerComponent ? (
            <BarcodeScannerComponent onBarCodeScanned={onScan} style={{flex:1}} />
          ) : (
            <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
              <Text style={{color:'white'}}>Barcode Scanner not available</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
