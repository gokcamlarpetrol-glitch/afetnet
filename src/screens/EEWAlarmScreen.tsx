import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { EEWAlert } from '../eew/types';
import { listEEW } from '../eew/store';
import { estimateETAAndMMI } from '../eew/estimate';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export default function EEWAlarmScreen(){
  const [last,setLast]=useState<EEWAlert|null>(null);
  const [eta,setEta]=useState<{eta:number;peta:number;label:string;mmi:number;dist:number}|null>(null);
  const sndRef = useRef<Audio.Sound|null>(null);

  useEffect(()=>{
    const t=(globalThis as any).setInterval(load,1500); load();
    const bh = BackHandler.addEventListener('hardwareBackPress', ()=> true); // prevent back
    return ()=>{ (globalThis as any).clearInterval(t); bh.remove(); stopSnd(); };
  },[]);

  async function load(){
    const arr = await listEEW(1);
    const a = arr[arr.length-1]; if(!a) {return;}
    // if already shown, skip
    if(last && last.id===a.id) {return;}
    setLast(a);
    const p = await Location.getLastKnownPositionAsync({}).catch(()=>null);
    const me = p? { lat:p.coords.latitude, lng:p.coords.longitude } : { lat:39, lng:35 };
    const est = estimateETAAndMMI({ lat:a.lat, lng:a.lng, depthKm:a.depth||10 }, me, a.mag);
    setEta({ eta: est.etaSec, peta: est.pEtaSec, label: est.label, mmi: est.mmi, dist: est.distKm });
    alertNow(est.label);
  }

  async function alertNow(level:string){
    // strong/severe → loud alarm + strong haptics; otherwise mild
    await Haptics.notificationAsync(level==='Severe' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning).catch(()=>{
      // Ignore haptic errors
    });
    try{
      const { sound } = await Audio.Sound.createAsync(
        // short embedded tone (replace with asset if needed)
        { uri: 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAA==' },
        { shouldPlay: true, isLooping: true, volume: 1.0 },
      );
      sndRef.current = sound;
    }catch{
      // Ignore audio creation errors
    }
  }
  async function stopSnd(){ try{ await sndRef.current?.stopAsync(); await sndRef.current?.unloadAsync(); }catch{
    // Ignore stop errors
  } }

  return (
    <View style={{ flex:1, backgroundColor:'#111827', alignItems:'center', justifyContent:'center', padding:14 }}>
      <Text style={{ color:'#ef4444', fontWeight:'900', fontSize:28, textAlign:'center' }}>ERKEN UYARI (DENEYSEL)</Text>
      {last && eta ? (
        <View style={{ marginTop:10, alignItems:'center' }}>
          <Text style={{ color:'#e5e7eb', fontSize:16 }}>Kaynak: {last.src} • M{last.mag.toFixed(1)}</Text>
          <Text style={{ color:'#f59e0b', fontSize:20, fontWeight:'800', marginTop:6 }}>
            Şiddet tahmini: {eta.label} (MMI {eta.mmi.toFixed(1)})
          </Text>
          <Text style={{ color:'#93c5fd', marginTop:4 }}>
            Uzaklık ≈ {eta.dist.toFixed(0)} km • P-dalga ~{Math.max(0,eta.peta|0)} sn • S/Şiddet ~{Math.max(0,eta.eta|0)} sn
          </Text>
          <Pressable onPress={stopSnd} style={{ backgroundColor:'#0b3d13', padding:10, borderRadius:10, marginTop:12 }}>
            <Text style={{ color:'white', fontWeight:'800' }}>SESSİZE AL</Text>
          </Pressable>
          <Pressable onPress={()=>{ stopSnd(); }} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10, marginTop:8 }}>
            <Text style={{ color:'white' }}>Kapat</Text>
          </Pressable>
          <Text style={{ color:'#94a3b8', fontSize:11, marginTop:10, textAlign:'center' }}>
            Not: Bu uyarı **resmi erken uyarı** değildir; deneysel tahmindir. Cihaz sensörleri/online feed mevcudiyetine bağlıdır.
          </Text>
        </View>
      ):(
        <Text style={{ color:'#cbd5e1', marginTop:8 }}>Uyarı bekleniyor…</Text>
      )}
    </View>
  );
}



