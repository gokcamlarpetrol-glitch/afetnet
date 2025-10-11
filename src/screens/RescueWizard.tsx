import React, { useState } from "react";
import { Alert, Button, SafeAreaView, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

type State = { self:string; team:string; debris:string; notes:string };

export default function RescueWizard(){
  const [step,setStep] = useState(0);
  const [s,setS] = useState<State>({ self:"", team:"", debris:"", notes:"" });

  async function finish(){
    const data = { ...s, ts: Date.now() };
    const path = "/tmp/" + `rescue_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data,null,2));
    if(await Sharing.isAvailableAsync()) {await Sharing.shareAsync(path,{ mimeType:"application/json" });}
    Alert.alert("Rescue","Rapor oluşturuldu");
  }

  const H = (t:string)=><Text style={{color:"white", fontSize:20, fontWeight:"700", marginBottom:8}}>{t}</Text>;
  const IN = (p:keyof State)=><TextInput
          accessibilityRole="text"
      placeholder={p}
      placeholderTextColor="#94a3b8"
      value={s[p]}
      onChangeText={(v)=>setS({...s,[p]:v})}
      style={{backgroundColor:"#111827", color:"white", padding:12, borderRadius:10, marginBottom:10}}/>;

  return (
    <SafeAreaView style={{flex:1, backgroundColor:"#0f172a", padding:16}}>
      {step===0 && <View>{H("1. Kendi Durumum")}{IN("self")}<Button title="Devam" onPress={()=>setStep(1)}/></View>}
      {step===1 && <View>{H("2. Ekip Durumu")}{IN("team")}<Button title="Devam" onPress={()=>setStep(2)}/></View>}
      {step===2 && <View>{H("3. Enkaz Raporu")}{IN("debris")}<Button title="Devam" onPress={()=>setStep(3)}/></View>}
      {step===3 && <View>{H("4. Onay & Paylaş")}{IN("notes")}<Button title="Tamamla & Paylaş" onPress={finish}/></View>}
    </SafeAreaView>
  );
}
