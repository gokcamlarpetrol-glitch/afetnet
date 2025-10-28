import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { startGateway } from '../gateway/bridge';
import { startAudioDetect, stopAudioDetect } from '../audio/detect';
import { sendULB } from '../ulb/api';
import { runPreflight } from '../safety/preflight';
import { getNeighborCount } from '../p2p/peers';
import { getPower, savePower } from '../power/profile';
import { latestEEW } from '../quake/state';
// import { now } from '../relief/util'; // TODO: Implement relief util

export default function HomeScreen(){
  const [bat,setBat]=useState<number>(0);
  const [neis,setNeis]=useState<number>(0);
  const [pf,setPf]=useState(getPower());
  const [eew,setEEW]=useState<{mag?:number; distKm?:number; when?:number; src?:string}|null>(null);
  const [pre,setPre]=useState<{ok:boolean; fails:number}>({ ok:false,fails:0 });

  useEffect(()=>{ (async()=>{
    setBat((await Battery.getBatteryLevelAsync())||0);
    const i=(globalThis as any).setInterval(async()=>{
      setNeis(await getNeighborCount());
      const q = await latestEEW(); setEEW(q);
    }, 3000);
    const p=await runPreflight(); setPre({ ok: p.checks.every(c=>c.ok), fails: p.checks.filter(c=>!c.ok).length });
    return ()=>(globalThis as any).clearInterval(i);
  })(); },[]);

  async function sos(){ await sendULB('sos','SOS'); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  async function safe(){ await sendULB('text','Ben güvendeyim'); }
  async function shareLoc(){ try{ const p=await Location.getLastKnownPositionAsync({}); if(p){ await sendULB('hb', undefined); } }catch{
    // Ignore location errors
  } }
  async function toggleAudio(){
    const on = !pf.audioDetect; const v = await savePower({ audioDetect:on }); setPf(v);
    if(on) {await startAudioDetect();} else {await stopAudioDetect();}
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      {!pre.ok && <View style={{ backgroundColor:'#ef4444', padding:8, borderRadius:8, marginBottom:8 }}><Text style={{ color:'white', fontWeight:'800' }}>Kontrol: {pre.fails} eksik var (Preflight)</Text></View>}
      <Text style={{ color:'white', fontSize:22, fontWeight:'900' }}>AfetNet – Acil Panel</Text>

      <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <Tile label="Komşu" value={String(neis)} />
        <Tile label="Pil" value={Math.round(bat*100)+'%'} />
        <Tile label="Güç Profili" value={pf.audioDetect? 'Ses Algı AÇIK':'Standart'} />
        <Tile label="EEW" value={eew? `M${eew.mag||'?'} • ~${eew.distKm?.toFixed?.(0)||'?'}km • ${timeAgo(eew.when)}` : '—'} />
      </View>

      <View style={{ flexDirection:'row', gap:8, marginTop:12, flexWrap:'wrap' }}>
        <Btn text="SOS" kind="danger" onPress={sos} />
        <Btn text="Güvendeyim" onPress={safe} />
        <Btn text="Konumu Paylaş" onPress={shareLoc} />
        <Btn text={pf.audioDetect? 'Ses Algı KAPAT':'Ses Algı AÇ'} onPress={toggleAudio} />
        <Btn text="Gateway Başlat" onPress={startGateway} />
      </View>

      <View style={{ marginTop:14 }}>
        <Text style={{ color:'#93c5fd' }}>İpucu: Yakın cihaz sayısı **Komşu**, ağın sağlıklı olduğunu gösterir. "Gateway" olan bir cihaz internet bulduğunda EEW/duyuruları mesh'e dağıtır.</Text>
      </View>
    </View>
  );
}

function Tile({ label,value }:{label:string;value:string}){ return <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10 }}><Text style={{ color:'#94a3b8', fontSize:12 }}>{label}</Text><Text style={{ color:'#e5e7eb', fontWeight:'800' }}>{value}</Text></View>; }
function Btn({ text,onPress,kind }:{text:string;onPress:()=>void;kind?:'danger'}){ return <Pressable onPress={onPress} style={{ backgroundColor: kind==='danger'?'#ef4444':'#2563eb', padding:10, borderRadius:10 }}><Text style={{ color:'white', fontWeight:'800' }}>{text}</Text></Pressable>; }
function timeAgo(t?:number){ if(!t) {return '—';} const s=Math.max(0,Math.round((Date.now()-t)/1000)); return s<60? s+'sn':'~'+Math.round(s/60)+'dk'; }



