import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Magnetometer } from 'expo-sensors';
import { createAudioDetector } from '../nearby/audioBeacon';
import { pushSample, getTarget, headingDiff, hapticFor, resetDir } from '../assist/direction';

export default function DirectionScreen(){
  const [head, setHead] = useState(0);
  const [lvl, setLvl] = useState(0);
  const detRef = useRef<any>(null);

  useEffect(()=>{
    resetDir();
    // heading
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener(({ x,y })=>{
      const deg = (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
      setHead(deg);
      pushSample(deg, lvl);
      setTgt(getTarget());
    });

    // audio
    const det = createAudioDetector();
    det.onLevel((l:number)=> setLvl(l));
    det.start();
    detRef.current = det;

    return ()=>{ try{ sub.remove(); }catch{
      // Ignore remove errors
    } detRef.current?.stop?.(); };
  },[]);

  useEffect(()=>{
    const id = (globalThis as any).setInterval(()=> { const d = headingDiff(head); hapticFor(d, lvl); }, 700);
    return ()=>(globalThis as any).clearInterval(id);
  },[head, lvl]);

  const d = headingDiff(head);
  const dirTxt = d==null ? 'Aranıyor…' : (Math.abs(d)<10 ? 'Hedef hizalı' : d>0 ? 'Sağa dön' : 'Sola dön');

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800', marginBottom:6 }}>Yönlendirme (Akustik + Titreşim)</Text>
      <Text style={{ color:'#94a3b8', marginBottom:10 }}>Telefonu yavaşça çevirin; sinyal en yüksek yönde hedef kilitlenir.</Text>
      <View style={{ width:220, height:220, borderRadius:110, borderWidth:2, borderColor:'#1f2937', alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:'#93c5fd', fontSize:48, fontWeight:'900' }}>{d==null ? '–' : (d>0 ? '↻' : '↺')}</Text>
      </View>
      <Text style={{ color:'#e5e7eb', marginTop:10 }}>Pusula: {head.toFixed(0)}° • Sinyal: {(lvl*100|0)}%</Text>
      <Text style={{ color:'#22c55e', marginTop:6, fontWeight:'700' }}>{dirTxt}</Text>
      <Text style={{ color:'#64748b', marginTop:8, fontSize:12 }}>Gürültüde "Hedef hizalı" kararı için birkaç saniye bekleyin.</Text>
    </View>
  );
}



