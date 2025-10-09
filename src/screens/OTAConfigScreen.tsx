import React, { useState, useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import SvgQRCode from "react-native-qrcode-svg";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import { applyConfig, getConfig, importFromFile, OTA, saveConfig, validate } from "../config/ota";

export default function OTAConfigScreen(){
  const [cfg, setCfg] = useState<OTA>({});
  const [scan, setScan] = useState(false);

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);

  React.useEffect(()=>{ getConfig().then(setCfg); },[]);

  async function onScan({data}: any){
    try{
      const obj = JSON.parse(String(data));
      if (!validate(obj)) {throw new Error("invalid");}
      await applyConfig(obj);
      setCfg(obj);
      Alert.alert("Yapılandırma","QR başarıyla uygulandı");
    }catch{ Alert.alert("Hata","Geçersiz QR/JSON"); }
    setScan(false);
  }

  async function onImport(){
    try{
      const c = await importFromFile();
      setCfg(c);
      Alert.alert("Dosya","Uygulandı");
    }catch(e:any){ if(String(e?.message)!=="cancelled") {Alert.alert("Hata","İçe aktarılamadı");} }
  }

  async function onApply(){
    try{ await applyConfig(cfg); Alert.alert("Uygulandı","Ayarlar aktif"); }catch(e:any){ Alert.alert("Hata", e?.message || "Olmadı"); }
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>OTA Yapılandırma (QR/JSON)</Text>

      <Field label="PIN" value={cfg.pin||""} onChange={(v)=>setCfg({...cfg, pin:v})}/>
      <Row>
        <Field label="Scan(ms)" value={String(cfg.duty?.scanMs ?? "")} onChange={(v)=>setCfg({...cfg, duty:{...cfg.duty, scanMs:Number(v||0)}})}/>
        <Field label="Pause(ms)" value={String(cfg.duty?.pauseMs ?? "")} onChange={(v)=>setCfg({...cfg, duty:{...cfg.duty, pauseMs:Number(v||0)}})}/>
      </Row>
      <Row>
        <Field label="SOS Period(ms)" value={String(cfg.sar?.sosEveryMs ?? "")} onChange={(v)=>setCfg({...cfg, sar:{...cfg.sar, sosEveryMs:Number(v||0)}})}/>
        <Field label="AutoText" value={String(cfg.sar?.autoText ?? "")} onChange={(v)=>setCfg({...cfg, sar:{...cfg.sar, autoText:v}})}/>
      </Row>

      <Row>
        <Toggle label="SAR Enabled" value={Boolean(cfg.sar?.enabled)} onToggle={(v)=>setCfg({...cfg, sar:{...cfg.sar, enabled:v}})} />
        <Toggle label="EPM Enabled" value={Boolean(cfg.epm?.enabled)} onToggle={(v)=>setCfg({...cfg, epm:{enabled:v}})} />
      </Row>

      <Btn title="Uygula" onPress={onApply}/>
      <Btn title="Dosyadan İçe Aktar (.json)" onPress={onImport}/>
      <Text style={{color:"#94a3b8", marginTop:10}}>Mevcut konfigürasyonu aşağıdaki QR ile paylaş:</Text>
      <View style={{alignItems:"center", marginVertical:12}}>{<SvgQRCode value={JSON.stringify(cfg)} size={220}/>}</View>
      <Btn title="QR Tara" onPress={()=>setScan(true)}/>
      {scan && (
        <View style={{height:280, marginTop:10}}>
          {BarcodeScannerComponent ? (
            <BarcodeScannerComponent onBarCodeScanned={onScan} style={{flex:1}}/>
          ) : (
            <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
              <Text style={{color:'white'}}>Barcode Scanner not available</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Field({label, value, onChange}:{label:string; value:string; onChange:(v:string)=>void}){
  return <View style={{flex:1, marginVertical:6}}>
    <Text style={{color:"#e5e7eb"}}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}}/>
  </View>;
}
function Row({children}:{children:any}){ return <View style={{flexDirection:"row", gap:8}}>{children}</View>; }
function Btn({title, onPress}:{title:string; onPress:()=>void}){
  return <Pressable onPress={onPress} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10, marginTop:8}}>
    <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>{title}</Text>
  </Pressable>;
}
function Toggle({label, value, onToggle}:{label:string; value:boolean; onToggle:(v:boolean)=>void}){
  return <Pressable onPress={()=>onToggle(!value)} style={{flex:1, backgroundColor:value?"#0b5":"#333", padding:12, borderRadius:10, alignItems:"center"}}>
    <Text style={{color:"white", fontWeight:"800"}}>{label}: {value?"Açık":"Kapalı"}</Text>
  </Pressable>;
}
