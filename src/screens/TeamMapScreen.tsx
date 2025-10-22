import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Beacon from '../ble/bridge';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

type Peer = { id:string; lat:number; lon:number; acc?:number; batt?:number; ts:number; };
export default function TeamMapScreen(){
  const [peers, setPeers] = useState<Peer[]>([]);
  const [threshold, setThreshold] = useState(20); // meters
  const lastAlert = useRef(0);
  const [me, setMe] = useState<{lat:number;lon:number}|null>(null);

  useEffect(()=>{ (async()=>{
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status==='granted'){
      const fix = await Location.getCurrentPositionAsync({});
      setMe({ lat: fix.coords.latitude, lon: fix.coords.longitude });
    }
    Beacon.start({ onNearby:(list:any[])=>{
      const ps = list.filter(x=>x.team && x.lat!=null && x.lon!=null).map(x=>({ id:x.id, lat:x.lat, lon:x.lon, acc:x.acc, batt:x.batt, ts:x.ts }));
      setPeers(ps);
    } });
  })(); return ()=>{ Beacon.stop(); }; },[]);

  useEffect(()=>{ if (!me) {return;}
    const now = Date.now();
    for (const p of peers){
      const d = haversine(me.lat, me.lon, p.lat, p.lon);
      if (d<=threshold && (now - lastAlert.current) > 8000){
        lastAlert.current = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{
          // Ignore haptic errors
        });
        // simple banner (Alert is ok for MVP)
        Alert.alert('Yakın Ekip', `${p.id} ≈ ${d.toFixed(0)} m`);
      }
    }
  },[peers, me, threshold]);

  async function ping(){
    await Beacon.broadcastTeamLocation();
    Alert.alert('Konum','Takım konumu yayınlandı');
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontWeight:'800', fontSize:20 }}>Takım Konumları (Şifreli)</Text>
      <Text style={{ color:'#94a3b8', marginBottom:10 }}>Aynı PIN'deki cihazlar birbirini görür.</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <Btn title="Konum Yayınla" onPress={ping}/>
        <Btn title={`Eşik: ${threshold} m`} onPress={()=> setThreshold( threshold===20? 50 : threshold===50? 100 : 20 )}/>
      </View>
      {peers.length===0 ? <Text style={{ color:'#64748b' }}>Takım konumu yok.</Text> :
        peers.map(p=><Text key={p.id} style={{ color:'#cbd5e1' }}>• {p.id.slice(0,6)} — {new Date(p.ts).toLocaleTimeString()} — {p.batt??'?'}%</Text>)
      }
      <Text style={{ color:'#64748b', marginTop:8, fontSize:12 }}>Not: Konumlar PIN ile şifrelenmiş kısa çerçevelerde paylaşılır.</Text>
    </View>
  );
}

function Btn({ title,onPress }:{title:string;onPress:()=>void}){
  return <Pressable onPress={onPress} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
    <Text style={{ color:'white', fontWeight:'800' }}>{title}</Text>
  </Pressable>;
}

// Rough haversine in meters
function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
  const R=6371000; const toRad=(x:number)=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}



