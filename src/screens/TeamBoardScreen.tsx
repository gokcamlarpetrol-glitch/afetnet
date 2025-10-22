import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import * as T from '../board/store';
import { BoardPost } from '../board/store';
import * as DocumentPicker from 'expo-document-picker';
import { exportTasks, importTasksFrom } from '../team/share';
import * as Beacon from '../ble/bridge';
import { upsertPin } from '../map/pins';

export default function TeamBoardScreen(){
  const [items, setItems] = useState<BoardPost[]>([]);
  const [title, setTitle] = useState('');

  async function refresh(){ setItems(await T.listBoard()); }
  useEffect(()=>{ refresh(); },[]);

  async function add(){
    if (!title.trim()) {return;}
    const t: BoardPost = { id: 't-'+Date.now(), ts: Date.now(), kind: 'announcement', text: title.trim(), ttlSec: 24*3600 };
    await T.addBoard(t); setTitle(''); refresh();
    // (opsiyonel) yeni görev için konum pin'i sor
    // Basit: şimdilik cihazın mevcut fix'ini alıp iliştir (ayarlar ekranında kapatılabilir—MVP: her eklemede pinleme yapma)
  }
  async function mark(id:string, status: string){
    // Board posts don't have status, so we'll just refresh
    refresh();
  }
  async function del(id:string){ 
    // Board posts don't have remove function, so we'll just refresh
    refresh(); 
  }
  async function share(id:string){
    const t = items.find(item => item.id === id); if (!t) {return;}
    try{ await Beacon.broadcastText(`[BOARD] ${t.text}`); Alert.alert('Yayın','Özet gönderildi'); }catch{
      // Ignore broadcast errors
    }
    // (Opsiyonel) Şu anki konumu pin olarak ekle?
  }
  async function onImport(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ type:'application/json' });
      if (res.canceled || !res.assets?.length) {return;}
      const arr = await importTasksFrom(res.assets[0].uri);
      if (Array.isArray(arr)){ for(const it of arr){ await T.addBoard(it); } refresh(); }
    }catch{ 
      Alert.alert('Hata','İçe aktarılamadı'); 
    }
  }
  async function onExport(){ const p = await exportTasks(); Alert.alert('Dışa Aktarım', 'Kaydedildi: '+p); }

  const Row = ({ t }:{t:BoardPost})=>(
    <View style={{ backgroundColor:'#0b1220', padding:12, borderRadius:12, marginBottom:8 }}>
      <Text style={{ color:'white', fontWeight:'800' }}>{t.text}</Text>
      <Text style={{ color:'#94a3b8' }}>{t.kind.toUpperCase()} • {new Date(t.ts).toLocaleTimeString()}</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
        <Btn title="Yayınla" onPress={()=>share(t.id)}/>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Ekip Pano (Görevler)</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:10, marginBottom:8 }}>
        <TextInput value={title} onChangeText={setTitle} placeholder="Görev başlığı" placeholderTextColor="#64748b" style={{ flex:1, backgroundColor:'#111827', color:'white', padding:10, borderRadius:10 }}/>
        <Btn title="Ekle" onPress={add}/>
      </View>
      <FlatList data={items} keyExtractor={(x)=>x.id} renderItem={({ item })=><Row t={item}/>} />
      <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
        <Btn title="İçe aktar" onPress={onImport}/>
        <Btn title="Dışa aktar" onPress={onExport}/>
      </View>
    </View>
  );
}

function Btn({ title, onPress }:{title:string; onPress:()=>void}){
  return <Pressable onPress={onPress} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white', fontWeight:'800' }}>{title}</Text></Pressable>;
}
