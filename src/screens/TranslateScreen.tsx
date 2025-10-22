import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { translate, Lang } from '../translate/phrasebook';
import { whisper } from '../family/whisper';

export default function TranslateScreen(){
  const [from,setFrom]=useState<Lang>('tr');
  const [to,setTo]=useState<Lang>('en');
  const [src,setSrc]=useState('');
  const [out,setOut]=useState('');

  function run(){ const t = translate(src, from, to); setOut(t); }
  async function sendULB(){ if(!out) {return;} await whisper(out); }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Çevrimdışı Mini Çeviri</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
        {(['tr','en','ar'] as Lang[]).map(l=>(
          <Pressable key={'f_'+l} onPress={()=>setFrom(l)} style={{ backgroundColor: from===l? '#2563eb':'#1f2937', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>Kaynak: {l.toUpperCase()}</Text>
          </Pressable>
        ))}
        {(['tr','en','ar'] as Lang[]).map(l=>(
          <Pressable key={'t_'+l} onPress={()=>setTo(l)} style={{ backgroundColor: to===l? '#10b981':'#1f2937', padding:8, borderRadius:8 }}>
            <Text style={{ color:'white' }}>Hedef: {l.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput placeholder="Metin (kısa cümle)" placeholderTextColor="#94a3b8" value={src} onChangeText={setSrc} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8 }}/>
      <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
        <Pressable onPress={run} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>ÇEVİR</Text></Pressable>
        <Pressable onPress={sendULB} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>ULB GÖNDER</Text></Pressable>
      </View>
      <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginTop:8 }}>
        <Text style={{ color:'#a7f3d0' }}>{out||'—'}</Text>
      </View>
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:8 }}>Not: Tam kapsam için ileride offline model entegre edilebilir; bu sürüm sabit sözlüktür.</Text>
    </View>
  );
}



