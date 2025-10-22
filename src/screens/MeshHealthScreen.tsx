import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { readOut } from '../mesh/queue';
import { debugP2P } from '../p2p/bleCourier';

export default function MeshHealthScreen(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{ const t=(globalThis as any).setInterval(async()=>{ const q=await readOut(1000); setRows(q); }, 2000); return ()=>(globalThis as any).clearInterval(t); },[]);
  const dbg = debugP2P();
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Mesh Sağlık</Text>
      <Text style={{ color:'#93c5fd' }}>Relay: {JSON.stringify(dbg?.relayOn||true)}</Text>
      <Text style={{ color:'#93c5fd' }}>RX objeleri: {Object.keys(dbg?.rx||{}).length}</Text>
      <FlatList
        style={{ marginTop:10 }}
        data={rows.slice().reverse()}
        keyExtractor={(x,i)=>String(i)}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:8, borderRadius:8, marginBottom:6 }}>
            <Text style={{ color:'#e5e7eb' }}>{item.kind} • {new Date(item.ts).toLocaleTimeString()} • tries={item.tries}</Text>
          </View>
        )}
      />
    </View>
  );
}