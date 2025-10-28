import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { HelpTicket } from '../relief/types';
import { makeId, now } from '../relief/util';
import { broadcastTicket, handleIncoming } from '../help/mesh';
import { listTickets, updateTicket } from '../help/store';
import * as Location from 'expo-location';
import { quantizeLatLng } from '../geo/coarse';

export default function HelpQueueScreen(){
  const [rows,setRows]=useState<HelpTicket[]>([]);
  const [title,setTitle]=useState(''); const [detail,setDetail]=useState('');
  const [kind,setKind]=useState<HelpTicket['kind']>('rescue');
  const [prio,setPrio]=useState<HelpTicket['prio']>('life');

  async function refresh(){ setRows((await listTickets()).sort((a,b)=> prioRank(a.prio)-prioRank(b.prio) || (a.ts-b.ts))); }

  useEffect(()=>{ refresh(); const t=(globalThis as any).setInterval(refresh, 3000); return ()=>(globalThis as any).clearInterval(t); },[]);

  async function submit(){
    const pos = await Location.getLastKnownPositionAsync({}).catch(()=>null);
    const q = pos? quantizeLatLng(pos.coords.latitude,pos.coords.longitude) : undefined;
    const t: HelpTicket = {
      id: makeId('h'),
      requesterId: 'current_user',
      title,
      description: detail,
      detail,
      kind,
      prio,
      priority: prio === 'life' ? 'critical' : prio === 'urgent' ? 'high' : 'normal',
      status:'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ts: now(),
      qlat: q?.lat,
      qlng: q?.lng
    };
    await broadcastTicket(t); setTitle(''); setDetail(''); refresh(); Alert.alert('Kaydedildi','Yardım çağrısı mesh\'e duyuruldu.');
  }

  async function setStatus(id:string, status:HelpTicket['status']){
    await updateTicket(id, { status }); refresh();
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Yardım Kuyruğu</Text>
      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:12, marginTop:8 }}>
        <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
          {(['medical','rescue','evac','supply','other'] as HelpTicket['kind'][]).map(k=>(
            <Pressable key={k} onPress={()=>setKind(k)} style={{ backgroundColor: kind===k? '#2563eb':'#1f2937', padding:8, borderRadius:8 }}>
              <Text style={{ color:'white' }}>{k}</Text>
            </Pressable>
          ))}
          {(['life','urgent','normal'] as HelpTicket['prio'][]).map(p=>(
            <Pressable key={p} onPress={()=>setPrio(p)} style={{ backgroundColor: prio===p? '#ef4444':'#1f2937', padding:8, borderRadius:8 }}>
              <Text style={{ color:'white' }}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput placeholder="Başlık" placeholderTextColor="#94a3b8" value={title} onChangeText={setTitle} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8 }}/>
        <TextInput placeholder="Detay (opsiyonel)" placeholderTextColor="#94a3b8" value={detail} onChangeText={setDetail} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:6 }}/>
        <Pressable onPress={submit} style={{ backgroundColor:'#ef4444', padding:10, borderRadius:10, marginTop:8 }}>
          <Text style={{ color:'white', textAlign:'center', fontWeight:'800' }}>YARDIM İSTE</Text>
        </Pressable>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.title} • {item.kind}</Text>
            <Text style={{ color:item.prio==='life'?'#ef4444': item.prio==='urgent'?'#f59e0b':'#93c5fd' }}>{item.prio.toUpperCase()} • {new Date(item.ts).toLocaleTimeString()}</Text>
            {!!item.detail && <Text style={{ color:'#cbd5e1', fontSize:12 }}>{item.detail}</Text>}
            <View style={{ flexDirection:'row', gap:8, marginTop:6, flexWrap:'wrap' }}>
              {(['queued','assigned','enroute','done','cancelled'] as const).map(s=>(
                <Pressable key={s} onPress={()=>setStatus(item.id, s)} style={{ backgroundColor:'#1f2937', padding:6, borderRadius:8 }}>
                  <Text style={{ color:'white' }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function prioRank(p:HelpTicket['prio']){ return p==='life'?0: p==='urgent'?1:2; }



