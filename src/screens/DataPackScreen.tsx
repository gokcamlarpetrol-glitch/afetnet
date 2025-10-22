import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { pickAndLoadDataPack } from '../datapack/loader';

export default function DataPackScreen(){
  const [sum,setSum]=useState<any>(null);
  async function load(){
    try{
      const s = await pickAndLoadDataPack();
      setSum(s); Alert.alert('Tamam', `Yüklendi: ${JSON.stringify(s)}`);
    }catch(e){ Alert.alert('Hata', String(e)); }
  }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>DataPack Yükleyici</Text>
      <Text style={{ color:'#94a3b8', textAlign:'center', marginTop:6, maxWidth:360 }}>
        Kurumlardan gelen offline veri paketlerini (JSON) içeri aktarır. Barınak/klinik listeleri ve ileride rota/nokta setleri.
      </Text>
      <Pressable onPress={load} style={{ backgroundColor:'#2563eb', padding:12, borderRadius:10, marginTop:12 }}>
        <Text style={{ color:'white', fontWeight:'800' }}>PAKET SEÇ & YÜKLE</Text>
      </Pressable>
      {!!sum && <Text style={{ color:'#a7f3d0', marginTop:8 }}>{JSON.stringify(sum)}</Text>}
    </View>
  );
}



