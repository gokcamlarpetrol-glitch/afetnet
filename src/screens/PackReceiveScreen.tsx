import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { getOffers } from '../p2p/bleCourier';
import { requestStart, getRxStates, requestMissing } from '../share/transfer';

export default function PackReceiveScreen(){
  const [offers,setOffers]=useState<any[]>([]);
  const [rx,setRx]=useState<any>({});
  const [path,setPath]=useState('');

  useEffect(()=>{
    const t=(globalThis as any).setInterval(()=>{
      setOffers(getOffers());
      setRx(getRxStates());
    }, 1500);
    return ()=>(globalThis as any).clearInterval(t);
  },[]);

  async function start(off:any){
    const def = off.man.kind==='datapack'? 'document://datapacks/'+off.man.name :
      off.man.kind==='mbtiles'? 'document://tiles/'+off.man.name :
        'document://tilepacks/'+off.man.name;
    const target = path || def;
    await requestStart(off.id, off.man, target);
    Alert.alert('Başladı', 'Eksik parçalar isteniyor…');
  }

  function progress(id:string){
    const st = rx[id]; if(!st) {return '—';}
    const total = st.man.chunks; const have = st.bit.have.filter(Boolean).length;
    return `${have}/${total} • %${Math.round(100*have/total)}`;
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>P2P Paket Al</Text>
      <TextInput placeholder="Hedef Yol (ops.)" placeholderTextColor="#94a3b8" value={path} onChangeText={setPath} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:8 }}/>
      <FlatList
        style={{ marginTop:10 }}
        data={offers}
        keyExtractor={(x)=>x.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.man.name}</Text>
            <Text style={{ color:'#93c5fd' }}>{item.man.kind} • {item.man.chunks} parça</Text>
            <Text style={{ color:'#a7f3d0' }}>{progress(item.id)}</Text>
            <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
              <Pressable onPress={()=>start(item)} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>İNDİR</Text></Pressable>
              <Pressable onPress={()=>requestMissing(item.id)} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>EKSİKLERİ İSTE</Text></Pressable>
            </View>
          </View>
        )}
      />
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:6 }}>Not: Transfer yakın temasta daha verimlidir; güç profili hızını etkiler.</Text>
    </View>
  );
}



