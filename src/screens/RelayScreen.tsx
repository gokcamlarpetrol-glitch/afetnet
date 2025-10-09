import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, View } from "react-native";
import * as Beacon from "../ble/bridge";
import * as RStore from "../relay/store";
import { startP2PRelay, stopP2PRelay } from "../relay/opportunistic";
import Sparkline from "../ui/Sparkline";
import { getBattSeries, startBatt } from "../telemetry/battery";
import { startForegroundNote, stopForegroundNote } from "../bg/service";

export default function RelayScreen(){
  const [on, setOn] = useState(false);
  const [list, setList] = useState<RStore.RelayMsg[]>([]);
  const [ing, setIng] = useState(0); const [fwd, setFwd] = useState(0); const [ddp, setDdp] = useState(0);
  const [batt, setBatt] = useState<number[]>([]);

  useEffect(()=>{ startBatt(); const t = setInterval(()=> setBatt(getBattSeries()), 5000); return ()=>clearInterval(t); },[]);

  useEffect(()=>{
    const t = setInterval(async ()=>{
      await RStore.load();
      setList(RStore.getAll().slice().reverse());
    }, 2000);
    return ()=>clearInterval(t);
  },[]);

  async function toggle(v:boolean){
    try{
      setOn(v);
      Beacon.setRelayMode(v);
      if (v){ await startP2PRelay(); await startForegroundNote(); } else { stopP2PRelay(); await stopForegroundNote(); }
    }catch(e:any){ Alert.alert("Röle", e?.message || "Açılamadı"); }
  }

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:20}}>Röle (Gönüllü Mesh)</Text>
      <Text style={{color:"#94a3b8", marginBottom:8}}>Yakındaki küçük mesajları topla, TTL ile ileri aktar. İnternet gerekmez.</Text>

      <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#111827", padding:12, borderRadius:12, marginBottom:10}}>
        <Text style={{color:"#e5e7eb", fontWeight:"700"}}>Röle Modu</Text>
        <Switch value={on} onValueChange={toggle}/>
      </View>

      <View style={{backgroundColor:"#111827", padding:12, borderRadius:12, marginBottom:10}}>
        <Text style={{color:"#e5e7eb", marginBottom:6}}>Pil</Text>
        <Sparkline data={batt} />
      </View>

      <Text style={{color:"#94a3b8", marginBottom:6}}>Mesajlar (son {list.length}):</Text>
      <FlatList
        data={list}
        keyExtractor={(m)=>m.id}
        renderItem={({item})=>(
          <View style={{backgroundColor:"#0b1220", padding:10, borderRadius:10, marginBottom:8}}>
            <Text style={{color:"#e5e7eb", fontWeight:"700"}}>#{item.id16} • ttl:{item.ttl} • hops:{item.hops}</Text>
            <Text style={{color:"#cbd5e1"}}>{item.text?.slice(0,120) || (item.blobB64 ? "[thumbnail]" : "")}</Text>
            <Text style={{color:"#64748b", fontSize:12}}>src:{item.src} • {new Date(item.ts).toLocaleTimeString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{color:"#64748b"}}>Henüz mesaj yok.</Text>}
      />
    </View>
  );
}
