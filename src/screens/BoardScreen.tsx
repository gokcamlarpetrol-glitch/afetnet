import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { BoardPost, listBoard, addBoard } from '../board/store';
import { quantizeLatLng } from '../geo/coarse';
import * as Location from 'expo-location';

function makeId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

export default function BoardScreen(){
  const [list,setList]=useState<BoardPost[]>([]);
  const [text,setText]=useState('');
  const [kind,setKind]=useState<BoardPost['kind']>('announcement');

  async function load(){ setList(await listBoard()); }
  useEffect(()=>{ load(); },[]);

  async function post(){
    if(!text.trim()) {return;}
    let q:any={}; try{ const p = await Location.getLastKnownPositionAsync({}); if(p){ const qll=quantizeLatLng(p.coords.latitude,p.coords.longitude); q={ qlat:qll.lat, qlng:qll.lng }; } }catch{
      // Ignore location errors
    }
    const item: BoardPost = { id: makeId(), ts: Date.now(), kind, text: text.trim().slice(0,180), ttlSec: 24*3600, ...q };
    await addBoard(item); setText(''); await load();
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a' }}>
      <View style={{ padding:12 }}>
        <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Topluluk Panosu (Offline)</Text>
        <Text style={{ color:'#94a3b8' }}>Yakındaki herkese açık kısa duyurular/SOS.</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={i=>i.id}
        renderItem={({ item })=>(
          <View style={{ padding:10, borderBottomWidth:1, borderColor:'#111827' }}>
            <Text style={{ color: item.kind==='sos'?'#fca5a5':'#e5e7eb', fontWeight:'700' }}>{item.kind.toUpperCase()}</Text>
            <Text style={{ color:'white' }}>{item.text}</Text>
            {typeof item.qlat==='number' && <Text style={{ color:'#93c5fd', fontSize:10 }}>~ konum mevcut</Text>}
            <Text style={{ color:'#9ca3af', fontSize:10 }}>{new Date(item.ts).toLocaleString()}</Text>
          </View>
        )}
      />

      <View style={{ flexDirection:'row', padding:12, gap:8, borderTopWidth:1, borderColor:'#111827' }}>
        <Pressable onPress={()=>setKind('sos')} style={{ backgroundColor: kind==='sos'?'#ef4444':'#1f2937', padding:8, borderRadius:8 }}>
          <Text style={{ color:'white' }}>SOS</Text>
        </Pressable>
        <Pressable onPress={()=>setKind('announcement')} style={{ backgroundColor: kind==='announcement'?'#2563eb':'#1f2937', padding:8, borderRadius:8 }}>
          <Text style={{ color:'white' }}>Duyuru</Text>
        </Pressable>
        <Pressable onPress={()=>setKind('system')} style={{ backgroundColor: kind==='system'?'#10b981':'#1f2937', padding:8, borderRadius:8 }}>
          <Text style={{ color:'white' }}>Sistem</Text>
        </Pressable>
        <TextInput placeholder="Kısa metin (180)" placeholderTextColor="#94a3b8"
          value={text} onChangeText={setText}
          style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        <Pressable onPress={post} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}>
          <Text style={{ color:'white' }}>Yayınla</Text>
        </Pressable>
      </View>
    </View>
  );
}



