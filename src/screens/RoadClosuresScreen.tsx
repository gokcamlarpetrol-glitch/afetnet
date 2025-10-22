import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Closure } from '../routing/types';
import { broadcastClosure, handleIncoming } from '../routing/mesh';

export default function RoadClosuresScreen(){
  const [edgeId,setEdgeId]=useState(''); const [reason,setReason]=useState<Closure['reason']>('rubble');
  const [ttl,setTtl]=useState('7200'); const [note,setNote]=useState('');
  async function submit(){
    if(!edgeId){ Alert.alert('Edge ID','Yol kenar kimliğini girin (datapack edge.id)'); return; }
    const c: Closure = { id: 'cl_'+Date.now().toString(36).slice(2,8), edgeId, reason, ts: Date.now(), ttlSec: parseInt(ttl||'0',10)||undefined, note };
    await broadcastClosure(c); Alert.alert('Yayınlandı','Kapanma bilgisi mesh\'e duyuruldu');
    setEdgeId(''); setNote('');
  }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Yol Kapanma Raporla</Text>
      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:12, marginTop:8 }}>
        <TextInput placeholder="Edge ID" placeholderTextColor="#94a3b8" value={edgeId} onChangeText={setEdgeId} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        <View style={{ flexDirection:'row', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {(['rubble','flood','police','unknown'] as Closure['reason'][]).map(r=>(
            <Pressable key={r} onPress={()=>setReason(r)} style={{ backgroundColor: reason===r? '#ef4444':'#1f2937', padding:8, borderRadius:8 }}>
              <Text style={{ color:'white' }}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
          <TextInput placeholder="Süre (sn) ops." placeholderTextColor="#94a3b8" value={ttl} onChangeText={setTtl} keyboardType="number-pad" style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
          <TextInput placeholder="Not (ops.)" placeholderTextColor="#94a3b8" value={note} onChangeText={setNote} style={{ flex:2, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        </View>
        <Pressable onPress={submit} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8, marginTop:8 }}><Text style={{ color:'white' }}>YAYINLA</Text></Pressable>
      </View>
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:8 }}>Not: Kapanma kimlikleri datapack'teki `edge.id` ile eşleşmelidir.</Text>
    </View>
  );
}



