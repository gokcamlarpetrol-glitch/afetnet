import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { FamilyContact } from '../family/types';
import { loadFamily } from '../family/store';
import { sendULB } from '../ulb/api';
import { subscribeULB } from '../ulb/p2p_sub';
import { famEncrypt, famDecrypt } from '../family/crypto';

type Row = { id:string; from:string; to?:string; type:string; body?:string; ts:number; acked?:boolean };

const mem: Record<string,Row[]> = {};

export default function FamilyChatScreen(){
  const [list,setList]=useState<FamilyContact[]>([]);
  const [sel,setSel]=useState<FamilyContact|null>(null);
  const [text,setText]=useState('');

  useEffect(()=>{ (async()=> setList(await loadFamily()))(); },[]);
  useEffect(()=>{ if(sel) { /* set rows for selected contact */ } },[sel?.id]);

  useEffect(()=> {
    const unsub = subscribeULB(async (raw:string)=>{
      try{
        const o = JSON.parse(raw);
        if(o.kind==='ulb_msg'){
          const to = o.to || 'broadcast';
          const key = to;
          const arr = mem[key]||[];
          let body = o.body;
          if(sel && o.to===sel.id){ body = await famDecrypt(sel.secret, String(o.body||'')); }
          arr.push({ id:o.id, from:o.from||'?', to:o.to, type:o.type, body, ts:o.ts });
          mem[key]=arr;
          if(sel && key===sel.id) {setRows([...arr]);}
        }
        if(o.kind==='ulb_ack'){
          // mark ack
          for(const k of Object.keys(mem)){
            const arr = mem[k]; const i = arr.findIndex(x=>x.id===o.id);
            if(i>=0){ arr[i].acked=true; if(sel && k===sel.id) {setRows([...arr]);} }
          }
        }
      }catch{
        // Ignore JSON parse errors
      }
    });
    return ()=>unsub();
  },[sel?.id]);

  async function send(kind:'text'|'sos'){
    if(!sel) {return;}
    const body = kind==='text'? text : 'SOS';
    const encBody = await famEncrypt(sel.secret, body);
    const id = await sendULB(kind, encBody, sel.id);
    const arr = mem[sel.id]||[];
    arr.push({ id, from:'me', to:sel.id, type:kind, body, ts: Date.now(), acked:false });
    mem[sel.id]=arr; setRows([...arr]); setText('');
    if(kind==='sos') {Alert.alert('Gönderildi','SOS yayınlandı (ACK gelene kadar periyodik tekrar)');}
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Aile Sohbet</Text>
      <FlatList
        horizontal
        style={{ maxHeight:72 }}
        data={list}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <Pressable onPress={()=>setSel(item)} style={{ backgroundColor: sel?.id===item.id? '#2563eb':'#1f2937', padding:8, borderRadius:8, marginRight:8 }}>
            <Text style={{ color:'white' }}>{item.name}</Text>
          </Pressable>
        )}
      />
      {!!sel && (
        <>
          <FlatList
            style={{ marginTop:10 }}
            data={rows.slice().reverse()}
            keyExtractor={(x)=>x.id}
            renderItem={({ item })=>(
              <View style={{ backgroundColor:item.from==='me'?'#0b1220':'#111827', padding:8, borderRadius:10, marginBottom:8 }}>
                <Text style={{ color:'#e5e7eb' }}>{item.body||item.type}</Text>
                <Text style={{ color:item.acked?'#10b981':'#f59e0b', fontSize:11 }}>{item.acked?'✓✓ Teslim':'✓ Gönderildi'}</Text>
              </View>
            )}
            inverted
          />
          <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
            <TextInput placeholder="Mesaj" placeholderTextColor="#94a3b8" value={text} onChangeText={setText} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
            <Pressable onPress={()=>send('text')} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>Gönder</Text></Pressable>
            <Pressable onPress={()=>send('sos')} style={{ backgroundColor:'#ef4444', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>SOS</Text></Pressable>
          </View>
        </>
      )}
    </View>
  );
}
