import React, { useState, useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { buildQuickBackup, restoreQuickBackup } from "../backup/quick";
import { buildEncryptedZip, restoreEncryptedZip } from "../backup/fullzip";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import QRCode from "react-native-qrcode-svg";

export default function BackupScreen(){
  const [pwd,setPwd]=useState("");
  const [chunks,setChunks]=useState<any[]|null>(null);
  const [mode,setMode]=useState<"idle"|"showqr"|"scanqr">("idle");
  const [fileUri,setFileUri]=useState<string>("");

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  async function makeQR(){
    if(!pwd) { Alert.alert("Parola","Gerekli"); return; }
    const ch = await buildQuickBackup(pwd);
    setChunks(ch); setMode("showqr");
  }
  async function onScan({ data }:any){
    try{
      const c = JSON.parse(data);
      if(!Array.isArray(c)) {return;} // we scan chunk-by-chunk or full array? For simplicity, expect array in one go (can adapt to multi scan)
      await restoreQuickBackup(c, pwd);
      Alert.alert("Tamam","QR yedek geri yüklendi"); setMode("idle");
    }catch(e:any){ Alert.alert("Hata", e?.message||"QR okunamadı"); }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Yedekleme (Şifreli)</Text>
      <TextInput placeholder="Parola" secureTextEntry placeholderTextColor="#94a3b8" value={pwd} onChangeText={setPwd} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:10 }}/>
      <View style={{ flexDirection:"row", gap:8, marginTop:10, flexWrap:"wrap" }}>
        <Pressable onPress={makeQR} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:8 }}><Text style={{ color:"white" }}>Hızlı QR Yedek</Text></Pressable>
        <Pressable onPress={async()=>{ if(!pwd) {return Alert.alert("Parola","Gerekli");} const p=await buildEncryptedZip(pwd); Alert.alert("Tamam","ZIP hazır:\n"+p.split("/").pop()); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8 }}><Text style={{ color:"white" }}>Tam ZIP Yedek</Text></Pressable>
      </View>

      {mode==="showqr" && chunks && (
        <View style={{ alignItems:"center", marginTop:12 }}>
          <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>QR Yedek</Text>
          {/* Basit: tüm parçaları tek karede liste olarak göm. (Geliştirme: her parçayı ayrı kare yapıp ilerleme ile göster) */}
          <QRCode value={JSON.stringify(chunks)} size={220}/>
        </View>
      )}
      {mode==="scanqr" && (
        <View style={{ height:260, borderRadius:12, overflow:"hidden", marginTop:12 }}>
          {BarcodeScannerComponent ? (
            <BarcodeScannerComponent onBarCodeScanned={onScan} style={{ flex:1 }}/>
          ) : (
            <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
              <Text style={{color:'white'}}>Barcode Scanner not available</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:10, marginTop:12 }}>
        <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>ZIP Geri Yükle</Text>
        <TextInput placeholder="Dosya URI (zip.enc)" placeholderTextColor="#94a3b8" value={fileUri} onChangeText={setFileUri} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:6 }}/>
        <Pressable onPress={async()=>{ if(!pwd||!fileUri) {return Alert.alert("Bilgi","Parola ve dosya URI gerekli");} await restoreEncryptedZip(fileUri, pwd); Alert.alert("Tamam","ZIP geri yüklendi"); }} style={{ backgroundColor:"#1f2937", padding:10, borderRadius:8, marginTop:8 }}>
          <Text style={{ color:"white", textAlign:"center" }}>ZIP Geri Yükle</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}