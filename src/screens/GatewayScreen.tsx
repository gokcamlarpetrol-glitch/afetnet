import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { startGateway, stopGateway } from '../gateway/bridge';

export default function GatewayScreen(){
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Yerel Gateway</Text>
      <Text style={{ color:'#94a3b8', textAlign:'center', marginTop:6, maxWidth:360 }}>
        Güç bağlıyken ve internet varken deprem/duyuru verilerini çekip mesh'e köprüler. Çevrede internet yoksa tek cihaz köprü görevi görür.
      </Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
        <Pressable onPress={startGateway} style={{ backgroundColor:'#10b981', padding:12, borderRadius:10 }}><Text style={{ color:'white', fontWeight:'800' }}>BAŞLAT</Text></Pressable>
        <Pressable onPress={stopGateway} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
      </View>
    </View>
  );
}