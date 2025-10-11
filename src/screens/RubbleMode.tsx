import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Switch, Button, Alert } from "react-native";
import { DEFAULTS } from "../beacon/model";
import { createBeacon, startBeaconLoop, stopBeaconLoop } from "../beacon/broadcaster";
import { fecEncode } from "../fec/fecLite";
import EmergencyQR from "../beacon/qr";

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type State = {
  message: string;
  sos: boolean;
  repeatSec: number;
  ttlSec: number;
  running: boolean;
  useFec: boolean;
}

export default function RubbleMode(){
  const [st, setSt] = useState<State>({
    message: "Enkaz altındayım. Sessiz mod. Yakın yardım.",
    sos: true,
    repeatSec: DEFAULTS.RUBBLE_REPEAT,
    ttlSec: DEFAULTS.SOS_TTL,
    running: false,
    useFec: true
  });

  useEffect(()=>{
    // Start beacon loop when screen mounts if running
    if(st.running) {startBeaconLoop();}
    return ()=> stopBeaconLoop();
  }, [st.running]);

  const start = async ()=>{
    if(!st.message.trim()){ Alert.alert("Mesaj boş olamaz"); return; }
    setSt(s=>({...s, running:true}));
    startBeaconLoop();
    const raw = st.message.slice(0, DEFAULTS.MAX_MSG);
    const msg = st.useFec ? fecEncode(raw) : raw;
    await createBeacon({
      id: uuid(),
      kind: st.sos ? "sos" : "announcement",
      msg,
      ts: Date.now(),
      ttlSec: st.ttlSec,
      repeatSec: st.repeatSec
    });
    Alert.alert("Yayın başladı", st.useFec ? "FEC ile yayınlanıyor." : "Yayın devrede.");
  };

  const stop = ()=>{
    stopBeaconLoop();
    setSt(s=>({...s, running:false}));
    Alert.alert("Yayın durduruldu","");
  };

  const qrPayload = {
    type: st.sos ? "SOS" : "ANN",
    msg: st.message.slice(0, DEFAULTS.MAX_MSG),
    ts: Date.now()
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Enkaz Modu</Text>
      <View style={styles.row}>
        <Text style={styles.lbl}>SOS Yayını</Text>
        <Switch value={st.sos} onValueChange={v=>setSt(s=>({...s, sos:v}))}/>
      </View>
      <View style={styles.row}>
        <Text style={styles.lbl}>FEC ile Yayınla</Text>
        <Switch value={st.useFec} onValueChange={v=>setSt(s=>({...s, useFec:v}))}/>
      </View>
      <TextInput
          accessibilityRole="text"
        style={styles.input}
        placeholder="Kısa mesaj (max 120)"
        value={st.message}
        onChangeText={t=>setSt(s=>({...s, message:t}))}
        maxLength={DEFAULTS.MAX_MSG}
      />
      <View style={styles.row}>
        <Text style={styles.lbl}>Tekrarlama (sn)</Text>
        <TextInput keyboardType="numeric" style={styles.num}
          value={String(st.repeatSec)}
          onChangeText={t=>setSt(s=>({...s, repeatSec: Math.max(45, Math.min(600, Number(t)||DEFAULTS.RUBBLE_REPEAT))}))}/>
      </View>
      <View style={styles.row}>
        <Text style={styles.lbl}>Süre (sn)</Text>
        <TextInput keyboardType="numeric" style={styles.num}
          value={String(st.ttlSec)}
          onChangeText={t=>setSt(s=>({...s, ttlSec: Math.max(600, Math.min(48*3600, Number(t)||DEFAULTS.SOS_TTL))}))}/>
      </View>

      <View style={styles.buttons}>
        {!st.running ? <Button title="Yayını Başlat" onPress={start}/> : <Button title="Yayını Durdur" onPress={stop}/>}
      </View>

      <Text style={styles.h2}>Acil QR Paylaş</Text>
      <EmergencyQR value={qrPayload}/>
      <Text style={styles.qrHint}>Yakındaki biri QR'ı taradığında mesajını ve saati görür.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root:{ flex:1, padding:16, backgroundColor:"#0f172a" },
  h1:{ fontSize:22, fontWeight:"700", marginBottom:12, color:"white" },
  h2:{ fontSize:18, fontWeight:"600", marginTop:16, color:"white" },
  row:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginVertical:8 },
  lbl:{ fontSize:16, color:"white" },
  input:{ borderWidth:1, borderColor:"#444", borderRadius:8, padding:10, color:"#fff", backgroundColor:"#111827" },
  num:{ borderWidth:1, borderColor:"#444", borderRadius:8, padding:8, minWidth:90, textAlign:"center", color:"#fff", backgroundColor:"#111827" },
  buttons:{ marginTop:12, gap:8 },
  qrHint:{ marginTop:8, opacity:0.7, color:"#94a3b8" }
});
