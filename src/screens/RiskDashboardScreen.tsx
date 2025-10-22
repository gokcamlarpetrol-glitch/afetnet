import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { CITIES } from '../risk/const';
import { listEEW } from '../eew/store';
import { estimateETAAndMMI } from '../eew/estimate';
import { encodeULB } from '../ulb/codec';
import { broadcastULB } from '../ulb/p2p';
import { broadcastTemplates } from '../ulb/templates';
import { EEWAlert } from '../eew/types';

type Row = { name:string; eta:number; mmi:number; label:string };

function label(mmi:number){
  if(mmi>=7.5) {return 'Çok Şiddetli';}
  if(mmi>=6.0) {return 'Şiddetli';}
  if(mmi>=4.5) {return 'Hafif-Orta';}
  return 'Zayıf';
}

export default function RiskDashboardScreen(){
  const [lastId,setLastId]=useState<string>('');

  async function compute(){
    const eews = await listEEW(5); if(!eews.length) {return;}
    const a = eews[eews.length-1]; if(!a) {return;}
    setLastId(a.id);
    const arr: Row[] = CITIES.map(c=>{
      const e = estimateETAAndMMI({ lat:a.lat, lng:a.lng, depthKm:a.depth||10 }, { lat:c.lat, lng:c.lng }, a.mag);
      return { name:c.name, eta: Math.max(0, Math.round(e.etaSec)), mmi: +e.mmi.toFixed(1), label: label(e.mmi) };
    }).sort((x,y)=> y.mmi - x.mmi);
    setRows(arr);
  }

  useEffect(()=>{ compute(); const t=(globalThis as any).setInterval(compute, 4000); return ()=>(globalThis as any).clearInterval(t); },[]);

  async function quickBroadcastTopN(n=5){
    const eews = await listEEW(1); const a = eews[eews.length-1] as EEWAlert|undefined; if(!a) {return;}
    const msgs = broadcastTemplates(a, rows, n);
    for(const m of msgs){
      const enc = await encodeULB(m.toLowerCase());
      await broadcastULB(enc);
    }
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Bölgesel Risk Panosu</Text>
      <Text style={{ color:'#93c5fd', marginTop:6 }}>Son uyarı: {lastId || '—'}</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
        <Pressable onPress={()=>quickBroadcastTopN(5)} style={{ backgroundColor:'#ef4444', padding:10, borderRadius:10 }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Top-5 ULB Yayınla</Text>
        </Pressable>
        <Pressable onPress={()=>quickBroadcastTopN(10)} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:10 }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Top-10 ULB Yayınla</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.name}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8, flexDirection:'row', justifyContent:'space-between' }}>
            <Text style={{ color:'white', width:140 }}>{item.name}</Text>
            <Text style={{ color:'#f59e0b', width:90, textAlign:'right' }}>ETA {item.eta}s</Text>
            <Text style={{ color:item.mmi>=6? '#ef4444': item.mmi>=4.5?'#f59e0b':'#93c5fd', width:90, textAlign:'right' }}>MMI {item.mmi.toFixed(1)}</Text>
            <Text style={{ color:'#cbd5e1', width:110, textAlign:'right' }}>{item.label}</Text>
          </View>
        )}
      />
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:6 }}>Not: Bu tahminler deneysel ve resmi bir uyarı değildir.</Text>
    </View>
  );
}



