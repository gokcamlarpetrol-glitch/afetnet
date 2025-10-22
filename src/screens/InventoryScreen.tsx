import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { InvItem, makeId } from '../ops/types';
import { loadInventory, upsertItem } from '../ops/inventoryStore';
import { broadcastInventory } from '../ops/inventoryMesh';

export default function InventoryScreen(){
  const [rows,setRows]=useState<InvItem[]>([]);
  const [name,setName]=useState(''); const [qty,setQty]=useState('1'); const [kind,setKind]=useState<InvItem['kind']>('tool');
  const [unit,setUnit]=useState(''); const [note,setNote]=useState('');

  async function refresh(){ setRows(await loadInventory()); }
  useEffect(()=>{ refresh(); },[]);

  async function add(){
    await upsertItem({ name, qty: parseInt(qty||'0',10), kind, unit, note });
    await broadcastInventory();
    setName(''); setQty('1'); setUnit(''); setNote(''); refresh();
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Envanter</Text>
      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:12, marginTop:8 }}>
        <TextInput placeholder="Ad" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
          <TextInput placeholder="Miktar" keyboardType="number-pad" placeholderTextColor="#94a3b8" value={qty} onChangeText={setQty} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
          <TextInput placeholder="Birim (adet, koli...)" placeholderTextColor="#94a3b8" value={unit} onChangeText={setUnit} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        </View>
        <TextInput placeholder="Not" placeholderTextColor="#94a3b8" value={note} onChangeText={setNote} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:6 }}/>
        <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
          {(['medical','tool','food','water','comm','other'] as InvItem['kind'][]).map(k=>(
            <Pressable key={k} onPress={()=>setKind(k)} style={{ backgroundColor: kind===k? '#2563eb':'#1f2937', padding:8, borderRadius:8 }}>
              <Text style={{ color:'white' }}>{k}</Text>
            </Pressable>
          ))}
          <Pressable onPress={add} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>EKLE/GAÜNCELLE</Text>
          </Pressable>
          <Pressable onPress={broadcastInventory} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>MESH'E YAYINLA</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows.slice().sort((a,b)=> (b.updated-a.updated))}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.name} • {item.kind}</Text>
            <Text style={{ color:'#93c5fd', fontSize:12 }}>{item.qty} {item.unit||''} • {new Date(item.updated).toLocaleTimeString()}</Text>
            {!!item.tagId && <View style={{ marginTop:6 }}><QRCode value={`AFN-TAG:${item.tagId}`} size={80}/></View>}
          </View>
        )}
      />
    </View>
  );
}



