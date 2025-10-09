import React, { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { start as startSAR, stop as stopSAR, isOn as sarOn, SarConfig } from "../sar/runner";
import { canTry, fail, success } from "../security/lockout";

export default function SARModeScreen(){
  const [pin, setPin] = useState("");
  const [ttl, setTtl] = useState("2");
  const [scanMs, setScanMs] = useState("6000");
  const [pauseMs, setPauseMs] = useState("4000");
  const [sosMs, setSosMs] = useState("12000");
  const [autoText, setAutoText] = useState("");
  const [on, setOn] = useState(sarOn());

  async function toggle(v:boolean){
    if (v){
      const ok = await canTry();
      if (!ok.ok) {return Alert.alert("Kilitli", `Çok fazla hatalı deneme. ${ok.wait}s sonra tekrar deneyin.`);}
      if (!pin || pin.length<2) { await fail(); return Alert.alert("PIN", "Takım PIN'i gerekli (en az 2 hane)."); }
      try{
        const cfg: SarConfig = {
          pin, ttlMax: parseInt(ttl||"2",10),
          scanMs: parseInt(scanMs||"6000",10),
          pauseMs: parseInt(pauseMs||"4000",10),
          sosEveryMs: parseInt(sosMs||"12000",10),
          autoText: autoText.trim() || undefined
        };
        await startSAR(cfg);
        setOn(true); await success();
        Alert.alert("SAR", "Arama-Kurtarma modu aktif.");
      }catch(e:any){ await fail(); Alert.alert("Hata", e?.message || "Açılamadı"); }
    } else {
      stopSAR(); setOn(false);
    }
  }

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:20}}>SAR (Arama-Kurtarma) Modu</Text>
      <Text style={{color:"#94a3b8", marginBottom:12}}>Takım PIN'i ile şifreli yayın, otomatik SOS döngüsü ve röle.</Text>

      <Text style={{color:"#e5e7eb"}}>Takım PIN</Text>
      <TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="örn. 112" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10, marginBottom:10}} />

      <View style={{flexDirection:"row", gap:8}}>
        <View style={{flex:1}}>
          <Text style={{color:"#e5e7eb"}}>TTL</Text>
          <TextInput value={ttl} onChangeText={setTtl} keyboardType="number-pad" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
        </View>
        <View style={{flex:1}}>
          <Text style={{color:"#e5e7eb"}}>Tarama (ms)</Text>
          <TextInput value={scanMs} onChangeText={setScanMs} keyboardType="number-pad" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
        </View>
        <View style={{flex:1}}>
          <Text style={{color:"#e5e7eb"}}>Bekleme (ms)</Text>
          <TextInput value={pauseMs} onChangeText={setPauseMs} keyboardType="number-pad" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
        </View>
      </View>

      <View style={{flexDirection:"row", gap:8, marginTop:10}}>
        <View style={{flex:1}}>
          <Text style={{color:"#e5e7eb"}}>SOS Periyodu (ms)</Text>
          <TextInput value={sosMs} onChangeText={setSosMs} keyboardType="number-pad" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
        </View>
        <View style={{flex:2}}>
          <Text style={{color:"#e5e7eb"}}>Oto Metin (opsiyonel)</Text>
          <TextInput value={autoText} onChangeText={setAutoText} placeholder="Kısa durum bilgisi" placeholderTextColor="#64748b" style={{backgroundColor:"#111827", color:"white", padding:10, borderRadius:10}} />
        </View>
      </View>

      <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#111827", padding:12, borderRadius:12, marginTop:14}}>
        <Text style={{color:"#e5e7eb", fontWeight:"700"}}>SAR Modu</Text>
        <Switch value={on} onValueChange={toggle}/>
      </View>

      <View style={{marginTop:10}}>
        <Text style={{color:"#64748b"}}>Not: Arka plan kısıtlamaları platforma göre değişir. En yüksek güvenilirlik için ekran açıkken kullanın.</Text>
      </View>
    </View>
  );
}



