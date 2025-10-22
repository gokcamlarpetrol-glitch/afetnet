import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { computeMatching } from '../match/compute';
import { broadcastTask } from '../tasks/p2p';
import { Task } from '../tasks/types';

export default function MatchScreen(){
  const [pairs,setPairs]=useState<any[]>([]);
  const [sos,setSos]=useState<any[]>([]);
  const [vols,setVols]=useState<any[]>([]);

  async function load(){
    const { volunteers, sos, pairs } = await computeMatching();
    setVols(volunteers); setSos(sos); setPairs(pairs);
  }
  useEffect(()=>{ load(); },[]);

  async function publish(){
    for(const p of pairs){
      if(!p?.volunteer || !p?.sos) {continue;}
      const t: Task = { id: 't_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), rev:1, ts: Date.now(), itemId: p.sos.id, assignee: p.volunteer.id, status: 'assigned' };
      await broadcastTask(t);
    }
    Alert.alert('Gönderildi','Eşleşmeler broadcast edildi');
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Gönüllü–SOS Eşleştirme</Text>
      <Text style={{ color:'#93c5fd' }}>Gönüllü: {vols.length} • SOS: {sos.length}</Text>
      <View style={{ marginTop:10 }}>
        {pairs.map((p,i)=>(
          <View key={i} style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:'white' }}>{p.volunteer?.id || '—'} ➜ {p.sos?.id || '—'}</Text>
            <Text style={{ color:'#94a3b8', fontSize:12 }}>{p.dist ? (p.dist/1000).toFixed(2)+' km' : '-'}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={publish} style={{ backgroundColor:'#2563eb', padding:12, borderRadius:10 }}>
        <Text style={{ color:'white', textAlign:'center', fontWeight:'800' }}>EŞLEŞMELERİ YAYINLA</Text>
      </Pressable>
      <Text style={{ color:'#94a3b8', fontSize:12, marginTop:8 }}>Gönüllüler "Konumumu Paylaş (yaklaşık)" açık tutmalı.</Text>
    </View>
  );
}



