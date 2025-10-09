import React, { useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { quantizeLatLng } from "../geo/coarse";
import { Msg } from "../msg/types";
import { appendOutbox, listInbox, isAcked } from "../msg/store";
import { wrapEncrypt, openDecrypt, EncEnvelope } from "../msg/e2eeEnvelope";
import { getSession } from "../crypto/e2ee/session";
import E2EESetupShow from "./E2EESetupShow";
import E2EESetupScan from "./E2EESetupScan";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { sayKey } from "../voice/voice";

function makeId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

export default function ChatScreen({ route, navigation }:any){
  const { rv, threadId, myDid } = route.params; // myDid from bleCourier (deviceShortId)
  const [text,setText] = useState("");
  const [items,setItems] = useState<Msg[]>([]);
  const [pendingAcks, setPendingAcks] = useState<Record<string, boolean>>({});
  const [secure,setSecure] = useState<boolean>(false);
  const flatRef = useRef<FlatList>(null);

  async function refresh(){
    const list = await listInbox(threadId, 500);
    setItems(list as any);
    // build ack table
    const acks: Record<string, boolean> = {};
    for(const m of list){ if(m.ack && m.ackFor) {acks[m.ackFor]=true;} }
    setPendingAcks(acks);
  }

  useEffect(()=>{ const t = setInterval(refresh, 4000); refresh(); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ (async()=>{ setSecure(!!(await getSession(threadId))); })(); },[threadId]);

  async function send(kind:"text"|"sos"="text"){
    const body = text.trim();
    if(kind==="text" && !body) {return;}
    let payload = body.slice(0,160);
    const meta:any={};
    if(secure){
      try{
        const env = await wrapEncrypt(threadId, payload);
        payload = JSON.stringify({ _e2ee:true, env });
        meta.e2ee = true;
      }catch{ /* if no session, fallback */ }
    }
    let q:any={};
    try{
      const p = await Location.getLastKnownPositionAsync({});
      if(p){ const qll = quantizeLatLng(p.coords.latitude, p.coords.longitude); q={ qlat:qll.lat, qlng:qll.lng }; }
    }catch{}
    const msg: Msg = {
      v:1, id: makeId(), threadId, from: myDid, ts: Date.now(),
      kind: kind, body: kind==="text" ? payload : "HELP",
      ttlSec: 24*3600, hops: 0, maxHops: 8, ...q, ...meta
    };
    await appendOutbox(msg);
    if(kind==="sos"){
      await sayKey("sos_sent");
    }
    setText("");
    setTimeout(refresh, 600);
  }

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:"#0f172a" }} behavior={Platform.OS==="ios"?"padding":undefined}>
      <View style={{ padding:12, borderBottomWidth:1, borderColor:"#111827" }}>
        <Text style={{ color:"white", fontWeight:"800" }}>Sohbet — RV {rv}</Text>
        <Text style={{ color:"#94a3b8", fontSize:12 }}>Şebekesiz / BLE store-and-forward</Text>
        <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
          <Pressable onPress={()=>navigation.navigate("e2eeshow") } style={{ backgroundColor:"#1f2937", paddingHorizontal:8, paddingVertical:6, borderRadius:8 }}>
            <Text style={{ color:"white", fontSize:12 }}>PreKey Göster</Text>
          </Pressable>
          <Pressable onPress={()=>navigation.navigate("e2eescan", { rv }) } style={{ backgroundColor:"#1f2937", paddingHorizontal:8, paddingVertical:6, borderRadius:8 }}>
            <Text style={{ color:"white", fontSize:12 }}>{secure?"E2EE Yenile":"PreKey Tara"}</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={flatRef}
        data={items}
        keyExtractor={(m)=>m.id}
        renderItem={({item})=>{
          const mine = item.from===myDid;
          const acked = pendingAcks[item.id];
          if(item.ack) {return null;}
          return (
            <View style={{ padding:8, alignItems: mine ? "flex-end":"flex-start" }}>
              <View style={{ backgroundColor: mine ? "#2563eb":"#1f2937", padding:10, borderRadius:10, maxWidth:"85%" }}>
                <Text style={{ color:"white" }}>
                  {item.kind==="sos"?"🆘 ":""}
                  {(item).__dec ? (item).__dec : (item.body?.startsWith("{\"_e2ee\"") ? "🔒 (şifreli)" : item.body)}
                </Text>
                {typeof item.qlat==="number" && typeof item.qlng==="number" && <Text style={{ color:"#93c5fd", fontSize:10, marginTop:4 }}>~ konum var</Text>}
                <Text style={{ color:"#9ca3af", fontSize:10, marginTop:4 }}>{new Date(item.ts).toLocaleTimeString()} {mine && (acked ? "✓✓":"✓…")}</Text>
              </View>
            </View>
          );
        }}
        onContentSizeChange={()=>flatRef.current?.scrollToEnd({animated:true})}
        onLayout={()=>flatRef.current?.scrollToEnd({animated:true})}
      />
      <View style={{ flexDirection:"row", padding:10, gap:8, borderTopWidth:1, borderColor:"#111827" }}>
        <Pressable onPress={()=>send("sos")} style={{ backgroundColor:"#ef4444", paddingHorizontal:12, paddingVertical:10, borderRadius:10 }}>
          <Text style={{ color:"white", fontWeight:"800" }}>🆘</Text>
        </Pressable>
        <TextInput
          placeholder="Mesaj yaz (160)"
          placeholderTextColor="#94a3b8"
          value={text} onChangeText={setText} maxLength={160}
          style={{ flex:1, backgroundColor:"#111827", color:"white", padding:10, borderRadius:10 }}
        />
        <Pressable onPress={()=>send("text")} style={{ backgroundColor:"#1f2937", paddingHorizontal:12, paddingVertical:10, borderRadius:10 }}>
          <Text style={{ color:"white", fontWeight:"800" }}>Gönder</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
