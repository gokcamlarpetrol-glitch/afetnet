import React, { useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
// import MapView, { Polyline } from "react-native-maps"; // Temporarily disabled for Expo Go
import { DrawKind, DrawShape } from "../draw/types";
import { broadcastShape } from "../draw/mesh";

export default function DrawingEditorScreen(){
  const [kind,setKind]=useState<DrawKind>("rubble");
  const [ttl,setTtl]=useState("10800");
  const [note,setNote]=useState("");
  const [pts,setPts]=useState<{lat:number;lng:number}[]>([]);
  const mapRef = useRef<MapView>(null);

  function onPress(e:any){
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPts(prev=> [...prev, { lat:latitude, lng:longitude }]);
  }
  async function save(){
    if(pts.length<2){ Alert.alert("Eksik","En az iki nokta çizin."); return; }
    const s: DrawShape = { id: "dw_"+Date.now().toString(36).slice(2,8), kind, coords: pts, ttlSec: parseInt(ttl||"0",10)||undefined, note, ts: Date.now() };
    await broadcastShape(s); setPts([]); setNote(""); Alert.alert("Gönderildi","Çizim mesh'e yayınlandı");
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <MapView ref={mapRef} style={{ flex:1 }} initialRegion={{ latitude:39, longitude:35, latitudeDelta:8, longitudeDelta:8 }} onPress={onPress}>
        {pts.length>1 && <Polyline coordinates={pts.map(p=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={5} strokeColor="#22c55e" />}
      </MapView>
      <View style={{ position:"absolute", bottom:8, left:8, right:8, backgroundColor:"#0b1220", padding:8, borderRadius:10 }}>
        <View style={{ flexDirection:"row", gap:8, flexWrap:"wrap" }}>
          {(["rubble","flood","blocked","hazard","note"] as DrawKind[]).map(k=>(
            <Pressable key={k} onPress={()=>setKind(k)} style={{ backgroundColor: kind===k? "#2563eb":"#1f2937", padding:8, borderRadius:8 }}>
              <Text style={{ color:"white" }}>{k}</Text>
            </Pressable>
          ))}
          <TextInput placeholder="TTL (sn)" placeholderTextColor="#94a3b8" value={ttl} onChangeText={setTtl} keyboardType="number-pad" style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, minWidth:90 }}/>
          <TextInput placeholder="Not (ops.)" placeholderTextColor="#94a3b8" value={note} onChangeText={setNote} style={{ flex:1, backgroundColor:"#111827", color:"white", padding:8, borderRadius:8 }}/>
          <Pressable onPress={save} style={{ backgroundColor:"#10b981", padding:8, borderRadius:8 }}>
            <Text style={{ color:"white" }}>YAYINLA</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}



