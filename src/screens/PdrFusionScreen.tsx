import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as PDR from '../pdr/pdr';
import { Complementary } from '../pdr/fusion';
import { toENU } from '../map/localproj';
import * as Location from 'expo-location';
import * as Beacon from '../ble/bridge';

export default function PdrFusionScreen(){
  const [on, setOn] = useState(false);
  const [snap, setSnap] = useState({ x:0, y:0, bx:0, by:0 });
  const f = useRef(new Complementary(0.15)).current;
  const last = useRef({ steps: 0 });
  const origin = useRef<{lat0:number;lon0:number}|null>(null);

  useEffect(()=>{ (async()=>{
    const { status } = await Location.requestForegroundPermissionsAsync();
    if(status==='granted'){
      const loc = await Location.getCurrentPositionAsync({});
      origin.current = { lat0: loc.coords.latitude, lon0: loc.coords.longitude };
    }
  })(); },[]);

  useEffect(()=>{ const t = (globalThis as any).setInterval(()=>{
    if (!on) {return;}
    const s = PDR.state;
    // Simple delta from step count
    const dSteps = Math.max(0, s.stepCount - last.current.steps);
    if (dSteps>0){
      const rad = s.heading*Math.PI/180;
      const dx = Math.cos(rad)*0.7*dSteps;
      const dy = Math.sin(rad)*0.7*dSteps;
      f.stepPdr({ x: dx, y: dy });
      last.current.steps = s.stepCount;
    }
  }, 200); return ()=>(globalThis as any).clearInterval(t); },[on]);

  useEffect(()=>{ if (!on) {return;}
    Beacon.start({ onNearby:(list)=>{
      // if any beacon with location exists, pick latest as absolute (dummy mapping to local frame for demo)
      const locs = list.filter(x=>x.lat!=null && x.lon!=null).sort((a,b)=> ((a as any).ts??0)-((b as any).ts??0));
      if (locs.length){
        const a = locs[locs.length-1];
        if(origin.current){
          const enu = toENU(a.lat!, a.lon!, origin.current);
          f.fixBeacon(enu);
          setSnap({ x: f.state.pos.x, y: f.state.pos.y, bx: f.state.pdrBias.x, by: f.state.pdrBias.y });
        }
      }
    } });
    return ()=>{ Beacon.stop(); };
  },[on]);

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>PDR + Beacon Birleşik Konum</Text>
      <Text style={{ color:'#94a3b8', marginBottom:8 }}>PDR hızlı, beacon sabit; birlikte daha güvenilir.</Text>
      <Text style={{ color:'#e5e7eb' }}>X: {snap.x.toFixed(1)} m  •  Y: {snap.y.toFixed(1)} m</Text>
      <Text style={{ color:'#64748b', marginBottom:12 }}>Bias: ({snap.bx.toFixed(2)}, {snap.by.toFixed(2)})</Text>
      <View style={{ flexDirection:'row', gap:8 }}>
        <Pressable onPress={()=>setOn(true)} style={{ backgroundColor:'#22c55e', padding:12, borderRadius:10 }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Başlat</Text>
        </Pressable>
        <Pressable onPress={()=>setOn(false)} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Durdur</Text>
        </Pressable>
      </View>
      <Text style={{ color:'#64748b', marginTop:12 }}>Not: Bu örnek basit bir yerel çerçeve kullanır; gerçek dünyada WGS84→UTM/Local tangent düzlem daha uygundur.</Text>
    </View>
  );
}
