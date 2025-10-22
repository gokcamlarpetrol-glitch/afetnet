import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { startAudioDetect, stopAudioDetect } from '../audio/detect';

export default function AudioDetectScreen(){
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Enkaz İçi Ses Algılama</Text>
      <Text style={{ color:'#94a3b8', textAlign:'center', marginTop:6, maxWidth:360 }}>
        Yardım çağrısı/düdük/panlama benzeri yüksek enerjili sesleri basit sezgisel yöntemle algılar ve SOS çağrısı oluşturur.
      </Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
        <Pressable onPress={startAudioDetect} style={{ backgroundColor:'#ef4444', padding:12, borderRadius:10 }}><Text style={{ color:'white', fontWeight:'800' }}>DİNLEMEYİ BAŞLAT</Text></Pressable>
        <Pressable onPress={stopAudioDetect} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
      </View>
      <Text style={{ color:'#94a3b8', fontSize:11, marginTop:10, textAlign:'center' }}>
        Not: iOS'ta arka planda sınırlıdır; ekran açık/ön plandayken en iyi çalışır. Gerçek FFT/ML için bare build gerekir.
      </Text>
    </View>
  );
}



