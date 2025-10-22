import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { __presence_debug } from '../p2p/bleCourier';

type Row = { id:string; last:number; hops?:number };
export default function RescueScannerScreen(){
  const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{
    const t=(globalThis as any).setInterval(()=>{ 
      const now=Date.now();
      const mem = __presence_debug();
      const out = Object.entries(mem).map(([id, data])=>({ id, last: data.last })).filter(x=> now-x.last < 60_000).sort((a,b)=>b.last-a.last);
      setRows(out);
    }, 1500);
    return ()=>(globalThis as any).clearInterval(t);
  },[]);
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Kurtarma Tarayıcı</Text>
      <FlatList
        style={{ marginTop:8 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:6 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.id}</Text>
            <Text style={{ color:'#93c5fd', fontSize:12 }}>son: {Math.round((Date.now()-item.last)/1000)} sn</Text>
          </View>
        )}
      />
      <Text style={{ color:'#94a3b8', fontSize:11 }}>Not: "presence" mesajları yalnızca yerel mesh için; internet gerekmez.</Text>
    </View>
  );
}
