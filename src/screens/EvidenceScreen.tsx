import React, { useRef, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Camera } from "expo-camera";
import { takePhoto, startAudio, stopAudio } from "../evidence/capture";
import { createPack, addItem, listPacks } from "../evidence/store";
import { exportPack } from "../evidence/zipper";
import { quantizeLatLng } from "../geo/coarse";

export default function EvidenceScreen(){
  const camRef = useRef<any>(null);
  const [packId, setPackId] = useState<string|null>(null);
  const [note, setNote] = useState("");
  const [rec, setRec] = useState<any>(null);
  const [items, setItems] = useState<{desc:string}[]>([]);

  async function ensurePack(){
    if(packId) {return packId;}
    // try get last location for coarse
    let q:any={};
    try{
      const Location = require("expo-location");
      const p = await Location.getLastKnownPositionAsync({});
      if(p){ const qll = quantizeLatLng(p.coords.latitude, p.coords.longitude); q = { qlat:qll.lat, qlng:qll.lng }; }
    }catch{}
    const pck = await createPack(q.qlat, q.qlng);
    setPackId(pck.id);
    return pck.id;
  }

  async function onShot(){
    const pid = await ensurePack();
    const r = await takePhoto(camRef);
    if(!r){ Alert.alert("Kamera","Çekilemedi"); return; }
    await addItem(pid, { t:"photo", path:r.path, w:r.w, h:r.h, ts: Date.now() });
    setItems(s=>[{desc:"Foto eklendi"},...s]);
  }
  async function onRecToggle(){
    if(rec){
      const r = await stopAudio(rec);
      setRec(null);
      if(!r){ Alert.alert("Ses","Kayıt bitirilemedi"); return; }
      const pid = await ensurePack();
      await addItem(pid, { t:"audio", path:r.path, ts: Date.now() });
      setItems(s=>[{desc:"Ses notu eklendi"},...s]);
    }else{
      const r = await startAudio();
      if(!r){ Alert.alert("Ses","Kayıt başlatılamadı"); return; }
      setRec(r);
    }
  }
  async function onAddNote(){
    if(!note.trim()) {return;}
    const pid = await ensurePack();
    await addItem(pid, { t:"note", text: note.trim(), ts: Date.now() });
    setNote("");
    setItems(s=>[{desc:"Metin notu eklendi"},...s]);
  }
  async function onFinish(){
    if(!packId){ Alert.alert("Paket yok","Önce en az bir öğe ekle"); return; }
    const packs = await listPacks();
    const p = packs.find(x=>x.id===packId);
    if(!p || !p.items.length){ Alert.alert("Boş","Pakette öğe yok"); return; }
    const out = await exportPack(p, true);
    Alert.alert("Tamamlandı","ZIP hazırlandı: "+out.split("/").pop());
    setPackId(null); setItems([]); setNote(""); setRec(null);
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:"#0f172a"}}>
      <View style={{ padding:14 }}>
        <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Kanıt/Delil Toplama (Offline)</Text>
        <Text style={{ color:"#94a3b8", marginVertical:6 }}>Foto • Ses • Not → tek pakette ZIP • P2P "evidence_notice" gönderir.</Text>
      </View>

      <View style={{ height:260, marginHorizontal:14, borderRadius:12, overflow:"hidden", borderWidth:1, borderColor:"#1f2937", backgroundColor:"#111827", justifyContent:"center", alignItems:"center" }}>
        <Text style={{color:"#94a3b8"}}>Kamera önizlemesi</Text>
        <Text style={{color:"#64748b", fontSize:12}}>Fotoğraf çekmek için "Foto Çek" butonuna basın</Text>
      </View>
      <View style={{ flexDirection:"row", gap:8, padding:14 }}>
        <Btn title="Foto Çek" onPress={onShot}/>
        <Btn title={rec? "Kaydı Bitir":"Ses Kaydı"} onPress={onRecToggle}/>
      </View>

      <View style={{ paddingHorizontal:14 }}>
        <TextInput
          placeholder="Kısa metin notu"
          placeholderTextColor="#94a3b8"
          value={note} onChangeText={setNote}
          style={{ backgroundColor:"#111827", color:"white", padding:12, borderRadius:10 }}
        />
        <View style={{ height:8 }}/>
        <Btn title="Not Ekle" onPress={onAddNote}/>
      </View>

      <View style={{ padding:14 }}>
        <Btn style={{ backgroundColor:"#16a34a" }} title="Paketi Bitir + P2P Yay + ZIP Paylaş" onPress={onFinish}/>
      </View>

      <View style={{ padding:14 }}>
        <Text style={{ color:"#e5e7eb", fontWeight:"700", marginBottom:6 }}>Son İşlemler</Text>
        {items.slice(0,8).map((x,i)=>(<Text key={i} style={{ color:"#94a3b8" }}>• {x.desc}</Text>))}
      </View>
    </ScrollView>
  );
}

function Btn({ title, onPress, style }:{ title:string; onPress:()=>void; style?:any }){
  return (
    <Pressable onPress={onPress} style={[{ backgroundColor:"#1f2937", padding:12, borderRadius:10, alignItems:"center" }, style]}>
      <Text style={{ color:"white", fontWeight:"800" }}>{title}</Text>
    </Pressable>
  );
}
