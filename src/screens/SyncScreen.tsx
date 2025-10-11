import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, Alert } from "react-native";
import SvgQRCode from "react-native-qrcode-svg";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import { useApp } from "../store/app";
import { makeEnvelope } from "../mesh/envelope"; // if exists; else inline a simple envelope
import { getQueueSnapshot, importEnvelopes } from "../store/app";
import { createPack, sharePack, pickAndReadPack } from "../mesh/pack";

export default function SyncScreen(){
  const { size, enqueue } = useApp();
  const [hasPerm, setHasPerm] = useState<boolean>(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrData, setQrData] = useState<string>("");
  const [stats, setStats] = useState({ exported:0, imported:0, packs:0 });

  useEffect(() => {
    SafeBarcodeScanner.requestPermissionsAsync().then((res: any) => {
      setHasPerm(res.status === "granted");
    });
  },[]);

  async function buildQR(){
    const envs = await getQueueSnapshot(3);
    if (!envs.length) {
      // fallback demo envelope
      const fake = await makeEnvelope({ type:"help", note:"qr", people:1, priority:"med", lat:null, lon:null });
      envs.push(fake);
    }
    const batch = { v:1, c: envs.length, items: envs };
    const s = JSON.stringify(batch);
    setQrData("AN1:"+ (typeof btoa !== 'undefined' ? btoa(s) : s));
    setStats(s0 => ({...s0, exported: s0.exported + envs.length}));
  }

  async function onCreatePack(){
    try{
      const envs = await getQueueSnapshot(10);
      if (!envs.length) { Alert.alert("Paket", "Kuyrukta aktarılacak öğe yok."); return; }
      const { path } = await createPack(envs);
      await sharePack(path);
      setStats(s => ({...s, packs: s.packs + 1}));
    }catch(e:any){
      Alert.alert("Paket", e?.message || "Paylaşım başarısız");
    }
  }

  async function onImportPack(){
    try{
      const pack = await pickAndReadPack();
      const n = await importEnvelopes(pack.items, enqueue);
      setStats(s => ({...s, imported: s.imported + n}));
      Alert.alert("Paket", `İçe aktarıldı: ${n} kayıt`);
    }catch(e:any){
      if (String(e?.message) !== "cancelled") {Alert.alert("Paket", e?.message || "İçe aktarma başarısız");}
    }
  }

  const Scanner = useMemo(()=>SafeBarcodeScanner.isAvailable() ? require('expo-barcode-scanner').BarCodeScanner : null,[]);

  function onBarCodeScanned({data}: {data: string}){
    try{
      const raw = String(data).replace(/^AN1:/,"");
      const json = typeof atob !== 'undefined' ? atob(raw) : raw;
      const obj = JSON.parse(json);
      if (obj?.v === 1 && Array.isArray(obj.items)){
        importEnvelopes(obj.items, enqueue).then(n => {
          setStats(s => ({...s, imported: s.imported + n}));
        });
      }
    }catch{}
    setScanOpen(false);
  }

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:16}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:22, marginBottom:2}}>Senkronizasyon</Text>
      <Text style={{color:"#94a3b8", marginBottom:12}}>İnternet/şebeke olmadan aktarım</Text>

      {/* QR Share */}
      <View style={{borderWidth:1, borderColor:"#22c55e33", borderRadius:14, padding:12, marginBottom:16}}>
        <Text style={{color:"#e2e8f0", fontWeight:"700", marginBottom:8}}>QR ile Paylaş/Tara</Text>
        {!qrData ? (
          <Pressable onPress={buildQR} style={{backgroundColor:"#22c55e", padding:12, borderRadius:10, marginBottom:8}}>
            <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>QR OLUŞTUR</Text>
          </Pressable>
        ) : (
          <View style={{alignItems:"center", padding:8}}>
            <SvgQRCode value={qrData} size={220}/>
            <Pressable onPress={()=>setQrData("")} style={{marginTop:8}}><Text style={{color:"#93c5fd"}}>Yeni oluştur</Text></Pressable>
          </View>
        )}
        <Pressable onPress={()=>setScanOpen(true)} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
          <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>QR TARA</Text>
        </Pressable>
      </View>

      {/* Share Pack */}
      <View style={{borderWidth:1, borderColor:"#22c55e33", borderRadius:14, padding:12}}>
        <Text style={{color:"#e2e8f0", fontWeight:"700", marginBottom:8}}>Paylaşım Paketi (.afet)</Text>
        <Pressable onPress={onCreatePack} style={{backgroundColor:"#22c55e", padding:12, borderRadius:10, marginBottom:8}}>
          <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>PAKET OLUŞTUR & PAYLAŞ</Text>
        </Pressable>
        <Pressable onPress={onImportPack} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10}}>
          <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>PAKET İÇE AKTAR</Text>
        </Pressable>
      </View>

      <View style={{marginTop:16}}>
        <Text style={{color:"#94a3b8"}}>Kuyruk: {size()} • QR aktarım: {stats.exported} • İçe aktarılan: {stats.imported} • Paket: {stats.packs}</Text>
      </View>

      <Modal visible={scanOpen} animationType="slide">
        <View style={{flex:1, backgroundColor:"black"}}>
          {!hasPerm ? (
            <View style={{flex:1, alignItems:"center", justifyContent:"center"}}>
              <Text style={{color:"white"}}>Kamera izni gerekli</Text>
            </View>
          ) : (
            <Scanner onBarCodeScanned={onBarCodeScanned} style={{flex:1}}/>
          )}
          <Pressable onPress={()=>setScanOpen(false)} style={{position:"absolute", top:48, right:16, backgroundColor:"#111827", padding:10, borderRadius:10}}>
            <Text style={{color:"white", fontWeight:"800"}}>Kapat</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
