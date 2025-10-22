import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import QRCodeSafe from '../ui/QRCodeSafe';
import { FamilyContact } from '../family/types';
import { loadFamily, upsert } from '../family/store';
import { sendULB } from '../ulb/api';

export default function FamilyLinkScreen(){
  const [name,setName]=useState(''); const [rel,setRel]=useState<FamilyContact['relation']>('diğer');

  async function refresh(){ /* refresh family data */ }
  useEffect(()=>{ refresh(); },[]);

  async function add(){
    if(!name) {return;}
    await upsert({ name, relation: rel });
    setName(''); refresh(); Alert.alert('Eklendi','QR/Kod ile karşı cihazda eşle');
  }

  async function pingHB(c:FamilyContact){ await sendULB('hb', undefined, c.id); Alert.alert('Gönderildi','Kalp atışı yayınlandı'); }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Aile Bağı</Text>
      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:12 }}>
        <TextInput placeholder="İsim" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        <View style={{ flexDirection:'row', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {(['anne','baba','eş','kardeş','çocuk','arkadaş','diğer'] as FamilyContact['relation'][]).map(r=>(
            <Pressable key={r} onPress={()=>setRel(r)} style={{ backgroundColor: rel===r? '#2563eb':'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>{r}</Text></Pressable>
          ))}
          <Pressable onPress={add} style={{ backgroundColor:'#10b981', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>EKLE</Text></Pressable>
        </View>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.name} • {item.relation}</Text>
            <Text style={{ color:'#93c5fd', fontSize:12 }}>Kod: {item.secret}</Text>
            <View style={{ marginTop:6, alignItems:'flex-start' }}>
              <QRCodeSafe value={JSON.stringify({ t:'AFN_FAM', id:item.id, s:item.secret })} size={90} />
            </View>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Pressable onPress={()=>pingHB(item)} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>Kalp Atışı Gönder</Text></Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
