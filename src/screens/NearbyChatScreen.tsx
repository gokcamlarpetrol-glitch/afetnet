import React, { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getP2P from "../p2p/P2P.native";
import type { P2PPeer } from "../p2p/P2P";

type Msg = { id: string; text: string; from?: string; ts: number };

export default function NearbyChatScreen(){
  const p2p = useRef(getP2P()).current;
  const [peers, setPeers] = useState<P2PPeer[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sel, setSel] = useState<P2PPeer | null>(null);

  useEffect(()=>{ (async ()=>{
    try{
      const raw = await AsyncStorage.getItem("nearby_msgs");
      if (raw) {setMsgs(JSON.parse(raw));}
    }catch{}
    await p2p.start({
      onPeers: setPeers,
      onMessage: (from, text, ts)=> {
        const m = { id: String(ts)+Math.random(), text, from: from.name, ts };
        setMsgs(prev=>{ const n=[...prev,m]; AsyncStorage.setItem("nearby_msgs", JSON.stringify(n)); return n; });
      },
      onError: (e)=> Alert.alert("P2P", e),
      onConnection: (peer, state)=>{}
    });
  })(); return ()=>{ p2p.stop(); }; },[]);

  async function send(){
    if (!sel) {return Alert.alert("Mesaj", "Önce bir eş seçin.");}
    const text = draft.trim();
    if (!text) {return;}
    try{
      await p2p.sendText(sel.id, text);
      const m = { id: Date.now()+Math.random()+"", text, ts: Date.now() };
      setMsgs(prev=>{ const n=[...prev,m]; AsyncStorage.setItem("nearby_msgs", JSON.stringify(n)); return n; });
      setDraft("");
    }catch(e:any){
      Alert.alert("Gönderilemedi", e?.message || "Tekrar deneyin.");
    }
  }

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:12}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Yakın Mesajlaşma (Offline)</Text>
      <Text style={{color:"#94a3b8", marginBottom:8}}>Aynı odadaki/katlardaki cihazlarla internet olmadan mesajlaşın.</Text>

      <FlatList
        horizontal
        data={peers}
        keyExtractor={(p)=>p.id}
        renderItem={({item})=>(
          <Pressable onPress={()=>setSel(item)} style={{padding:10, borderRadius:8, marginRight:8, backgroundColor: sel?.id===item.id ? "#22c55e" : "#1f2937"}}>
            <Text style={{color:"white", fontWeight:"700"}}>{item.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{color:"#64748b"}}>Eş aranıyor…</Text>}
        style={{maxHeight:54, marginBottom:8}}
      />

      <View style={{flexDirection:"row", gap:8, marginBottom:8}}>
        <TextInput
          accessibilityRole="text"
          placeholder="Mesaj yazın…"
          placeholderTextColor="#64748b"
          value={draft}
          onChangeText={setDraft}
          style={{flex:1, backgroundColor:"#111827", color:"white", padding:12, borderRadius:10}}
        />
        <Pressable onPress={send} style={{backgroundColor:"#22c55e", paddingHorizontal:16, borderRadius:10, justifyContent:"center"}}>
          <Text style={{color:"white", fontWeight:"800"}}>Gönder</Text>
        </Pressable>
      </View>

      <FlatList
        data={msgs.sort((a,b)=>a.ts-b.ts)}
        keyExtractor={(m)=>m.id}
        renderItem={({item})=>(
          <View style={{padding:8, marginBottom:6, backgroundColor:"#111827", borderRadius:8}}>
            <Text style={{color:"#93c5fd", fontSize:12}}>{item.from ? `↘ ${item.from}` : "↗ Ben"}</Text>
            <Text style={{color:"#e5e7eb"}}>{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
}



