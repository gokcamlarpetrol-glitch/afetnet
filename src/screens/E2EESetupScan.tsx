import React, { useMemo } from "react";
import { Alert, View, Text } from "react-native";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import { createSessionFromBundles } from "../crypto/e2ee/session";
import { ensureIdentity } from "../crypto/e2ee/identity";
import { threadFromRV } from "../rv/rv";

export default function E2EESetupScan({ route, navigation }:any){
  const { rv } = route.params; // tie session to a thread via RV code
  async function onScan({ data }:any){
    try{
      const peer = JSON.parse(data);
      const { ik_sk, pre_sk, pre_pk } = await ensureIdentity();
      const threadId = await threadFromRV(rv);
      await createSessionFromBundles(threadId, { sk: pre_sk, pk: pre_pk }, { ik_pub: new Uint8Array(Buffer.from(peer.ik_pub_b64,"base64")), spk_pub: new Uint8Array(Buffer.from(peer.spk_pub_b64,"base64")) });
      Alert.alert("E2EE","Oturum hazır"); navigation.goBack();
    }catch{ Alert.alert("Hata","Geçersiz QR"); }
  }
  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

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
