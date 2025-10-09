import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import * as Battery from "expo-battery";
import * as Beacon from "../ble/bridge";
import { enable as enableRelay, disable as disableRelay, isEnabled as relayOn } from "../bridge/Relay";
import { setGroupPinCrypto, setDutyCycle } from "../ble/bridge";
import { canTry, fail, success } from "../security/lockout";
import { startTicker, stopTicker, isOn as tickerOn } from "../team/autoTicker";

export default function BeaconScreen(){
  const [list, setList] = useState<any[]>([]);
  const [pin, setPin] = useState("");
  const [relay, setRelay] = useState(relayOn());
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  useEffect(()=>{ Beacon.start({ onNearby:setList }); return ()=>{ Beacon.stop(); }; },[]);

  const statusOptions = [
    "2 Kişiyiz",
    "Yaralı Var", 
    "Kat: -1",
    "Acil Nefes Darlığı",
    "Sesimi Duyuyorsanız"
  ];

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  async function sos(){
    try{
      const lvl = await Battery.getBatteryLevelAsync();
      await Beacon.broadcastSOS(()=> Math.round((lvl??0)*100), selectedStatuses);
      Alert.alert("SOS","Yakın cihazlara SOS+konum yayınlandı (10 sn).");
    }catch(e:any){ Alert.alert("Hata", e?.message || "Yayınlanamadı."); }
  }
  async function send(text:string){
    if (!text.trim()) {return;}
    await Beacon.broadcastText(text.trim());
  }

  async function toggleRelay(v:boolean){
    try{
      if (v){ await enableRelay(); } else { await disableRelay(); }
      setRelay(v);
    }catch(e:any){ Alert.alert("Köprü", e?.message || "Açılamadı"); }
  }

  async function guardedSetPin(v:string){
    setPin(v);
    if (!v || v.length<2){ await fail(); }
    else { await success(); }
  }

  useEffect(()=>{ Beacon.setGroupPin(pin); },[pin]);
  useEffect(()=>{ setGroupPinCrypto(pin); },[pin]);

  return (
    <View style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontSize:20, fontWeight:"800"}}>Şebekesiz Yayın (BLE Beacon)</Text>
      <Text style={{color:"#94a3b8", marginBottom:8}}>Yakındaki cihazlara internet olmadan SOS ve konum yayınlayın.</Text>

      <View style={{backgroundColor:"#111827", padding:12, borderRadius:10, marginBottom:10}}>
        <Text style={{color:"#e5e7eb", marginBottom:6}}>Grup PIN (opsiyonel)</Text>
        <TextInput value={pin} onChangeText={guardedSetPin} keyboardType="number-pad" placeholder="örn. 112" placeholderTextColor="#64748b" style={{backgroundColor:"#0b1220", color:"white", padding:10, borderRadius:8}} />
      </View>

      <Pressable onPress={sos} style={{backgroundColor:"#ef4444", padding:14, borderRadius:12, alignItems:"center", marginBottom:8}}>
        <Text style={{color:"white", fontWeight:"800"}}>🔴 YARDIM İSTE (SOS)</Text>
      </Pressable>

      <Text style={{color:"#94a3b8", fontSize:14, marginBottom:8, marginTop:4}}>Durumunu Belirt:</Text>
      <View style={{flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:8}}>
        {statusOptions.map((status) => (
          <Pressable
            key={status}
            onPress={() => toggleStatus(status)}
            style={{
              backgroundColor: selectedStatuses.includes(status) ? "#3b82f6" : "#1f2937",
              paddingHorizontal:12,
              paddingVertical:8,
              borderRadius:20,
              borderWidth:1,
              borderColor: selectedStatuses.includes(status) ? "#3b82f6" : "#374151"
            }}
          >
            <Text style={{
              color: selectedStatuses.includes(status) ? "white" : "#94a3b8",
              fontSize:12,
              fontWeight: selectedStatuses.includes(status) ? "600" : "400"
            }}>
              {status}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{flexDirection:"row", gap:8, alignItems:"center", justifyContent:"space-between", backgroundColor:"#111827", padding:12, borderRadius:12, marginBottom:8}}>
        <Text style={{color:"#e5e7eb", fontWeight:"700"}}>Köprü Modu (P2P ↔ BLE)</Text>
        <Switch value={relay} onValueChange={toggleRelay} />
      </View>

      <View style={{flexDirection:"row", justifyContent:"space-between", backgroundColor:"#111827", padding:12, borderRadius:12, marginBottom:8}}>
        <Text style={{color:"#e5e7eb"}}>Enerji Profili (tarama: 6s / durak: 4s)</Text>
        <Pressable onPress={()=>{ setDutyCycle(4000,6000); Alert.alert("Enerji","Düşük güç modu (4s tarama, 6s bekleme)"); }} style={{backgroundColor:"#1f2937", padding:8, borderRadius:8}}>
          <Text style={{color:"white"}}>Düşük Güç</Text>
        </Pressable>
      </View>

      <Text style={{color:"#94a3b8", marginVertical:6}}>Yakındaki yayınlar:</Text>
      <FlatList
        data={list.sort((a,b)=> (b.ts??0)-(a.ts??0))}
        keyExtractor={(x)=>x.id+String(x.ts??"")}
        renderItem={({item})=>(
          <View style={{backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8}}>
            {item.lat!=null ? (
              <Text style={{color:"#e5e7eb"}}>📍 {item.lat.toFixed(5)}, {item.lon.toFixed(5)} • 🔋{item.batt}%</Text>
            ): item.txt ? (
              <Text style={{color:"#e5e7eb"}}>✉️ {item.txt}</Text>
            ) : null}
            {item.statuses && item.statuses.length > 0 && (
              <View style={{flexDirection:"row", flexWrap:"wrap", gap:4, marginTop:6}}>
                {item.statuses.map((status: string, index: number) => (
                  <View key={index} style={{
                    backgroundColor:"#ef4444",
                    paddingHorizontal:8,
                    paddingVertical:2,
                    borderRadius:12
                  }}>
                    <Text style={{color:"white", fontSize:10}}>{status}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{color:"#64748b", fontSize:12}}>id: {item.id}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{color:"#64748b"}}>Henüz yayın algılanmadı…</Text>}
      />
      <View style={{flexDirection:"row", gap:8, backgroundColor:"#111827", padding:12, borderRadius:12, marginTop:8}}>
        <Text style={{color:"#e5e7eb", flex:1}}>Takım Konumu Otomatik</Text>
        <Pressable onPress={()=>{ tickerOn()? stopTicker(): startTicker(15000); }} style={{backgroundColor:"#1f2937", padding:8, borderRadius:8}}>
          <Text style={{color:"white"}}>{tickerOn()? "Kapat" : "Aç"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
