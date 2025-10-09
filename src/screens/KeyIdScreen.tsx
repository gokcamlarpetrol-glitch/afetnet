import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getPublicKeyB64 } from "../crypto/keys";
import QRCode from "react-native-qrcode-svg";

export default function KeyIdScreen(){
  const [pub,setPub] = useState("");
  useEffect(()=>{ (async()=>setPub(await getPublicKeyB64()))(); },[]);
  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color:"white", fontSize:18, marginBottom:10 }}>Cihaz Kamu Anahtarı (Ed25519)</Text>
      {pub ? <QRCode value={pub} size={220}/> : <Text style={{ color:"#94a3b8" }}>Hazırlanıyor…</Text>}
      {pub ? <Text style={{ color:"#93c5fd", marginTop:10, fontSize:12 }}>{pub}</Text> : null}
    </View>
  );
}



