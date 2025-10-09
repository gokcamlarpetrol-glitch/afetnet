import React, { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, Text, View } from "react-native";
import { isTorchOn, torchOff, torchOn, startMorseSOS, stopMorseSOS, startScreenStrobe, stopScreenStrobe } from "../assist/torch";

export default function SOSToolsScreen(){
  const [torch, setTorch] = useState(false);
  const [morse, setMorse] = useState(false);
  const [strobe, setStrobe] = useState(false);
  const [white, setWhite] = useState(false);

  async function toggleTorch(){
    try{
      if (torch){ await torchOff(); setTorch(false); }
      else { await torchOn(); setTorch(true); }
    }catch{ Alert.alert("Fener","Açılamadı (izin/donanım)."); }
  }
  async function toggleMorse(){
    try{
      if (morse){ await stopMorseSOS(); setMorse(false); }
      else { await startMorseSOS(); setMorse(true); }
    }catch{ Alert.alert("Morse","Başlatılamadı."); }
  }
  function toggleStrobe(){
    if (strobe){ stopScreenStrobe(setWhite); setStrobe(false); }
    else { startScreenStrobe(setWhite); setStrobe(true); }
  }

  return (
    <SafeAreaView style={{flex:1, backgroundColor:white ? "white" : "#0f172a"}}>
      <View style={{padding:14}}>
        <Text style={{color:white ? "#0f172a":"white", fontSize:20, fontWeight:"800"}}>Görsel Sinyal</Text>
        <View style={{flexDirection:"row", gap:8, marginTop:10}}>
          <Btn title={torch?"Fener Kapat":"Fener Aç"} onPress={toggleTorch}/>
          <Btn title={morse?"Morse Durdur":"Morse SOS"} onPress={toggleMorse}/>
        </View>
        <View style={{marginTop:10}}>
          <Btn title={strobe?"Strobe Durdur":"Ekran Strobe"} onPress={toggleStrobe}/>
          <Text style={{color:white ? "#0f172a":"#fca5a5", marginTop:8, fontSize:12}}>Uyarı: Hızlı yanıp sönme bazı kullanıcılar için tetikleyici olabilir.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
function Btn({title,onPress}:{title:string;onPress:()=>void}){
  return <Pressable onPress={onPress} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10, marginRight:8}}><Text style={{color:"white", fontWeight:"800"}}>{title}</Text></Pressable>;
}



