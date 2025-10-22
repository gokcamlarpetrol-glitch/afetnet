import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';
import { startAudioBeacon, createAudioDetector } from '../nearby/audioBeacon';
import { ensureBlePermissions, scan, NearbyEntry, startAdvertisingStub } from '../nearby/ble';

export default function NearbyScreen(){
  const [beaconOn, setBeaconOn] = useState(false);
  const stopper = useRef<{stop:()=>Promise<void>}|null>(null);

  const [listening, setListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const [bleOn, setBleOn] = useState(false);
  const [devices, setDevices] = useState<Record<string,NearbyEntry>>({});

  useEffect(() => {
    (async () => {
      await Location.requestForegroundPermissionsAsync().catch(()=>{
        // Ignore permission errors
      });
    })();
  }, []);

  async function toggleBeacon(){
    if (!beaconOn){
      try{
        const h = await startAudioBeacon();
        stopper.current = h;
        setBeaconOn(true);
      }catch(e:any){
        Alert.alert('Sesli İşaret', e?.message || 'Başlatılamadı');
      }
    } else {
      try { await stopper.current?.stop(); } catch {
        // Ignore stop errors
      }
      stopper.current = null;
      setBeaconOn(false);
    }
  }

  async function toggleListen(){
    if (!listening){
      const det = createAudioDetector();
      det.onLevel((l)=> setAudioLevel(l));
      await det.start();
      // @ts-ignore
      (toggleListen as any)._det = det;
      setListening(true);
    } else {
      // @ts-ignore
      const det = (toggleListen as any)._det;
      if (det) {await det.stop();}
      setListening(false);
      setAudioLevel(0);
    }
  }

  async function startBleScan(){
    try{
      await ensureBlePermissions();
      const stop = scan((entry)=>{
        setDevices(prev => ({ ...prev, [entry.id]: entry }));
      });
      // keep in ref to stop when toggling off
      // @ts-ignore
      (startBleScan as any)._stop = stop;
      setBleOn(true);
    }catch(e:any){
      Alert.alert('Bluetooth', e?.message || 'Tarama başlatılamadı');
    }
  }
  function stopBleScan(){
    // @ts-ignore
    const st = (startBleScan as any)._stop;
    if (st) {st();}
    setBleOn(false);
    setDevices({});
  }

  async function tryAdvertise(){
    try{ await startAdvertisingStub(); }
    catch(e:any){ Alert.alert('Bluetooth', e?.message || 'Bu platformda yayın desteklenmiyor.'); }
  }

  const data = Object.values(devices).sort((a,b)=> (b.rssi ?? -999) - (a.rssi ?? -999));

  const approx = (l:number) => {
    // naive mapping
    if (l > 0.75) {return '≈1-3 m';}
    if (l > 0.5)  {return '≈3-6 m';}
    if (l > 0.3)  {return '≈6-10 m';}
    return '10m+';
  };

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:16 }}>
      <Text style={{ color:'white', fontSize:22, fontWeight:'800', marginBottom:8 }}>Yakındakiler (Offline)</Text>
      <Text style={{ color:'#94a3b8', marginBottom:12 }}>Acil durumda cihazlarınızı yakın bulmak için Sesli İşaret ve Bluetooth tarama.</Text>

      {/* Audio Beacon */}
      <View style={{ borderWidth:1, borderColor:'#22c55e33', borderRadius:12, padding:12, marginBottom:12 }}>
        <Text style={{ color:'#e2e8f0', fontWeight:'700', marginBottom:8 }}>Sesli İşaret (her cihazda çalışır)</Text>
        <Pressable onPress={toggleBeacon} style={{ backgroundColor: beaconOn ? '#b91c1c' : '#22c55e', padding:12, borderRadius:10, marginBottom:8 }}>
          <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>{beaconOn ? 'İŞARETİ DURDUR' : 'İŞARETİ BAŞLAT (SOS)'} </Text>
        </Pressable>
        <Pressable onPress={toggleListen} style={{ backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
          <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>{listening ? 'DİNLEMEYİ DURDUR' : 'İŞARETİ DİNLE'}</Text>
        </Pressable>
        {listening && (
          <View style={{ marginTop:8 }}>
            <Text style={{ color:'#93c5fd' }}>Sinyal: {(audioLevel*100|0)}% • Yaklaşık mesafe: {approx(audioLevel)}</Text>
          </View>
        )}
      </View>

      {/* BLE Proximity */}
      <View style={{ borderWidth:1, borderColor:'#22c55e33', borderRadius:12, padding:12 }}>
        <Text style={{ color:'#e2e8f0', fontWeight:'700', marginBottom:8 }}>Bluetooth Yakınlık (beta)</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          <Pressable onPress={bleOn ? stopBleScan : startBleScan} style={{ flex:1, backgroundColor: bleOn ? '#b91c1c' : '#22c55e', padding:12, borderRadius:10 }}>
            <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>{bleOn ? 'TARAMAYI DURDUR' : 'YAKINLARI TARA'}</Text>
          </Pressable>
          <Pressable onPress={tryAdvertise} style={{ flex:1, backgroundColor:'#1f2937', padding:12, borderRadius:10 }}>
            <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>GÖRÜNÜR OL (beta)</Text>
          </Pressable>
        </View>
        <FlatList
          style={{ marginTop:8 }}
          data={data}
          keyExtractor={(it)=>it.id}
          renderItem={({ item })=>(
            <View style={{ padding:10, borderBottomWidth:1, borderBottomColor:'#1f2937' }}>
              <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.name || 'AfetNet'}</Text>
              <Text style={{ color:'#94a3b8' }}>RSSI: {item.rssi ?? '?'} • {item.proximity}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color:'#475569', textAlign:'center', marginTop:8 }}>Henüz cihaz bulunamadı.</Text>}
        />
        {Platform.OS === 'ios' && <Text style={{ color:'#64748b', marginTop:6 }}>iOS: Ön planda yalnız BLE tarama desteklenir. Android'de yayın + tarama mümkün.</Text>}
      </View>
    </View>
  );
}



