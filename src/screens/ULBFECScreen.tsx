import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { fecBroadcast, fecRecover, FECFrame } from "../ulb/fec";
import { fecBroadcastX } from "../ulb/fec_ext";
import { initNAK } from "../ulb/fec_nak";
import { subscribeULB } from "../ulb/p2p_sub";
import { decodeULB } from "../ulb/codec";

export default function ULBFECScreen(){
  const [text,setText]=useState("afetnet test fec iletisi");
  const [buf,setBuf]=useState<Record<string,FECFrame[]>>({});

  useEffect(()=>{
    // pseudo subscriber: add a hook in bleCourier to deliver decoded text frames labeled "fec_..."
    const unsub = subscribeULB(async (raw:string)=>{
      try{
        const obj = JSON.parse(raw);
        if(obj && obj.gid && (obj.idx!=null)){
          setBuf(prev=>{
            const arr = prev[obj.gid] || [];
            return { ...prev, [obj.gid]: [...arr, obj as FECFrame].slice(-10) };
          });
        }
      }catch{}
    });
    const unsubNAK = initNAK();
    return ()=>{ unsub(); unsubNAK(); };
  },[]);

  async function send(){ await fecBroadcastX(text, 3, 2, 100); Alert.alert("Gönderildi","FEC (interleave+retry) ile yayınlandı"); }

  function tryRecover(gid:string){
    const frames = buf[gid]||[];
    const rec = fecRecover(frames);
    Alert.alert("Kurtarma", rec? rec : "yetersiz parça");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>ULB FEC</Text>
      <TextInput placeholder="Mesaj" placeholderTextColor="#94a3b8" value={text} onChangeText={setText} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
      <View style={{ flexDirection:"row", gap:8, marginTop:8 }}>
        <Pressable onPress={send} style={{ backgroundColor:"#2563eb", padding:8, borderRadius:8 }}><Text style={{ color:"white" }}>FEC ile Yayınla</Text></Pressable>
      </View>
      <FlatList
        style={{ marginTop:10 }}
        data={Object.keys(buf)}
        keyExtractor={k=>k}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item}</Text>
            <Text style={{ color:"#93c5fd" }}>{buf[item].length} parça</Text>
            <Pressable onPress={()=>tryRecover(item)} style={{ backgroundColor:"#1f2937", padding:6, borderRadius:8, marginTop:6 }}>
              <Text style={{ color:"white" }}>Kurtarmayı Dene</Text>
            </Pressable>
          </View>
        )}
      />
      <Text style={{ color:"#94a3b8", fontSize:11, marginTop:6 }}>Not: Basit XOR paritesi yalnızca **1 parça** eksikken kurtarır; ileri FEC (RS) için yerel kütüphane gerekir.</Text>
    </View>
  );
}
