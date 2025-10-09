import React, { useState, useMemo } from "react";
import { Alert, View, Text } from "react-native";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import { saveAttest } from "../evidence/attest";

export default function AttestCollectScreen(){
  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  async function onScan({ data }:any){
    try{
      const o = JSON.parse(data);
      if(o?.t!=="attest_reply") {return;}
      await saveAttest(o.att);
      Alert.alert("Kaydedildi","Onay eklendi");
    }catch{ Alert.alert("Hata","Geçersiz QR"); }
  }
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      {BarcodeScannerComponent ? (
        <BarcodeScannerComponent onBarCodeScanned={onScan} style={{ flex:1 }}/>
      ) : (
        <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
          <Text style={{color:'white'}}>Barcode Scanner not available</Text>
        </View>
      )}
    </View>
  );
}
