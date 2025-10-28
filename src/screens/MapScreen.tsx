import React, { useEffect, useState } from 'react';
import { View, Text, useWindowDimensions, Pressable, Alert, Modal } from 'react-native';
import HeatOverlay from './HeatOverlay';
import * as Beacon from '../ble/bridge';
import { openDbFromUri } from '../offline/mbtiles-server';
import { startMbtilesServer, stopMbtilesServer, localTileUrlTemplate } from '../offline/mbtiles-server';
import { SafeMBTiles } from '../offline/SafeMBTiles';
import { toENU } from '../map/localproj';
import * as Location from 'expo-location';
import { listPins } from '../map/pins';
import { listBetween, speedsFrom } from '../history/collector';
import TrailOverlay from '../ui/TrailOverlay';
import HeatGridOverlay from '../ui/HeatGridOverlay';
import NetInfo from '@react-native-community/netinfo';
import GoToTarget from './GoToTarget';
import { startTrapped, stopTrapped } from '../trapped/mode';
import { loadFamily } from '../family/store';
import * as Haptics from 'expo-haptics';
import * as Battery from 'expo-battery';
import { offlineMessaging } from '../services/OfflineMessaging';
import { logger } from '../utils/productionLogger';

// Import expo-maps with fallback
let ExpoMap: any = null;
try { 
  const maps = (globalThis as any).require('expo-maps');
  ExpoMap = maps.default;
} catch {
  // expo-maps not available - fallback to alternative map solution
}

// Types for offline peer tracking
type Peer = { id: string; lat: number; lon: number; acc?: number; batt?: number; ts: number; kind?: string; name?: string };
type FamilyMember = { id: string; name: string; qlat?: number; qlng?: number; lastSeen?: number };

export default function MapScreen(){
  const { width, height } = useWindowDimensions();
  const [useLocal, setUseLocal] = useState(false);
  const [pins, setPins] = useState<any[]>([]);
  const [trail, setTrail] = useState<{x:number;y:number}[]>([]);
  const [speeds, setSpeeds] = useState<number[]>([]);
  const [center, setCenter] = useState<{lat:number;lon:number}|null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Offline peer tracking (family members, team members, trapped persons)
  const [peers, setPeers] = useState<Peer[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [beacons, setBeacons] = useState<{x:number;y:number}[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<{lat:number;lon:number;label:string}|null>(null);
  const [showGoToTarget, setShowGoToTarget] = useState(false);
  const [trappedMode, setTrappedMode] = useState(false);
  const [showTrappedAlert, setShowTrappedAlert] = useState(false);

  // Offline messaging integration
  const [offlineStats, setOfflineStats] = useState({ total: 0, delivered: 0, pending: 0, sos: 0 });
  const [offlineContacts, setOfflineContacts] = useState<any[]>([]);

  // Network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Offline messaging system initialization
  useEffect(() => {
    const startOfflineMessaging = async () => {
      try {
        await offlineMessaging.start();
        updateOfflineData();
        logger.debug('Offline messaging started in MapScreen');
      } catch (error) {
        logger.error('Failed to start offline messaging in MapScreen:', error);
      }
    };

    startOfflineMessaging();

    // Update offline data every 10 seconds
    const updateInterval = setInterval(updateOfflineData, 10000);

    return () => {
      offlineMessaging.stop();
      clearInterval(updateInterval);
      logger.debug('Offline messaging stopped in MapScreen');
    };
  }, []);

  const updateOfflineData = () => {
    try {
      const stats = offlineMessaging.getMessageStats();
      const contacts = offlineMessaging.getContacts();

      setOfflineStats(stats);
      setOfflineContacts(contacts);

      logger.debug(`MapScreen - Offline stats updated: ${stats.total} messages, ${contacts.length} contacts`);
    } catch (error) {
      logger.error('Failed to update offline data in MapScreen:', error);
    }
  };

  useEffect(()=>{ 
    let origin: {lat0:number; lon0:number}|null = null;
    (async()=>{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status==='granted'){
        const loc = await Location.getCurrentPositionAsync({});
        origin = { lat0: loc.coords.latitude, lon0: loc.coords.longitude };
      }
      Beacon.start({ onNearby:(list)=>{
        if(origin){
          const pts = list.filter(x=>x.lat!=null && x.lon!=null).slice(-50) as any[];
          const s = pts.map(p=>{ const enu = toENU(p.lat, p.lon, origin!); return { x: width/2 + enu.x/2, y: height/2 - enu.y/2, w:1 }; });
          setBeacons(s);
          
          // Track peers for offline map display
          const peerList = list.filter(x=>x.lat!=null && x.lon!=null).map(x=>({
            id: x.id || 'unknown',
            lat: x.lat!,
            lon: x.lon!,
            acc: (x as any).acc,
            batt: x.batt,
            ts: (x as any).ts || Date.now(),
            kind: (x as any).kind || 'peer',
            name: (x as any).name,
          }));
          setPeers(peerList);
        } else {setBeacons([]); setPeers([]);}
      } });
    })();
    return ()=>{ Beacon.stop(); };
  },[width,height]);
  
  // Load family members
  useEffect(() => {
    (async () => {
      try {
        const family = await loadFamily();
        setFamilyMembers(family);
      } catch {
        // Failed to load family - continue with empty list
      }
    })();
  }, []);

  async function onImportMbtiles(){
    try{
      const uri = await SafeMBTiles.pickMbtiles();
      await openDbFromUri(uri);
      await startMbtilesServer();
      setUseLocal(true);
      Alert.alert('Harita', 'Yerel tile sunucusu aktif.');
    }catch(e:any){
      if (String(e?.message) !== 'cancelled') {Alert.alert('Harita','İçe aktarılamadı.');}
    }
  }

  useEffect(()=>()=>{ stopMbtilesServer(); },[]);

  async function refreshPins(){ setPins(await listPins()); }
  async function refreshTrail(hours=2){
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status!=='granted') {return;}
    const fix = await Location.getCurrentPositionAsync({}); 
    const ctr = { lat: fix.coords.latitude, lon: fix.coords.longitude };
    setCenter(ctr);
    const t1 = Date.now(), t0 = t1 - hours*3600*1000;
    const pts = await listBetween(t0,t1);
    const sp = speedsFrom(pts);
    const R=6378137; 
    const scale = 1/2; // px per meter
    const proj = (lat:number,lon:number)=>{
      const dx=(lon-ctr.lon)*Math.cos(ctr.lat*Math.PI/180)*Math.PI/180*R;
      const dy=(lat-ctr.lat)*Math.PI/180*R;
      return { x: width/2 + dx*scale, y: height/2 - dy*scale };
    };
    setTrail(pts.map(p=>proj(p.lat,p.lon))); setSpeeds(sp);
  }

  useEffect(()=>{ refreshPins(); refreshTrail(2); const t = (globalThis as any).setInterval(()=>refreshTrail(2), 60000); return ()=>(globalThis as any).clearInterval(t); },[width,height]);
  
  // Helper functions for offline features
  function handleMarkerPress(peer: Peer) {
    Alert.alert(
      peer.kind === 'trapped' ? '🚨 Enkaz Altı Kişi' : peer.kind === 'family' ? '👨‍👩‍👧‍👦 Aile Üyesi' : '👥 Takım Üyesi',
      `${peer.name || peer.id}\nKonum: ${peer.lat.toFixed(6)}, ${peer.lon.toFixed(6)}\nBatarya: ${peer.batt || '?'}%\nSon Görülme: ${new Date(peer.ts).toLocaleTimeString()}`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Oraya Git', 
          onPress: () => {
            setSelectedTarget({ lat: peer.lat, lon: peer.lon, label: peer.name || peer.id });
            setShowGoToTarget(true);
          },
        },
        {
          text: 'SOS Gönder',
          style: 'destructive',
          onPress: async () => {
            const batt = await Battery.getBatteryLevelAsync();
            await Beacon.broadcastSOS(() => batt * 100, ['manual_sos']);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('SOS', 'SOS mesajı gönderildi');
          },
        },
      ],
    );
  }
  
  async function toggleTrappedMode() {
    if (trappedMode) {
      stopTrapped();
      setTrappedMode(false);
      Alert.alert('Enkaz Modu', 'Enkaz modu kapatıldı');
    } else {
      setShowTrappedAlert(true);
    }
  }
  
  async function confirmTrappedMode() {
    setShowTrappedAlert(false);
    startTrapped();
    setTrappedMode(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('🚨 Enkaz Modu', 'Enkaz modu aktif! 5 dakika hareketsiz kalırsanız otomatik SOS gönderilecek.');
  }
  
  async function broadcastMyLocation() {
    await Beacon.broadcastTeamLocation();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Konum', 'Konumunuz BLE üzerinden yayınlandı');
  }

  if(!ExpoMap){
    return (
      <View style={{ flex:1, backgroundColor:'#0f172a' }}>
        <Text style={{ color:'#94a3b8', padding:12 }}>Harita modülü devre dışı. Aşağıda ısı katmanı örneği var.</Text>
        <View style={{ flex:1 }}/>
        <Pressable onPress={onImportMbtiles} style={{ backgroundColor:'#1f2937', padding:14, margin:12, borderRadius:12 }}>
          <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>.MBTILES İÇE AKTAR</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex:1 }}>
      {/* Enhanced Offline indicator */}
      {!isOnline && (
        <View style={{ position:'absolute', top:0, left:0, right:0, backgroundColor:'#f97316', padding:8, zIndex:1000 }}>
          <Text style={{ color:'white', fontWeight:'bold', textAlign:'center' }}>
            📴 ÇEVRİMDIŞI MOD - BLE Mesh Network Aktif!
          </Text>
          <Text style={{ color:'white', fontSize:12, textAlign:'center', marginTop:2 }}>
            {offlineStats.total} mesaj • {offlineContacts.length} kişi • {offlineStats.sos} SOS
          </Text>
        </View>
      )}

      <ExpoMap style={{ flex:1 }}>
        {useLocal && (
          <ExpoMap.TileOverlay urlTemplate={localTileUrlTemplate()} zIndex={-1} maximumZ={18} flipY={false} />
        )}
        
        {/* Regular Pins */}
        {pins.map((pin) => (
          <ExpoMap.Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lon }}
            title={pin.title}
            description={`${pin.kind} - ${pin.status || 'Aktif'}`}
            pinColor={pin.kind === 'task' ? 'red' : 'blue'}
          />
        ))}
        
        {/* Family Members (Offline) */}
        {familyMembers.filter(f => f.qlat && f.qlng).map((member) => (
          <ExpoMap.Marker
            key={`family-${member.id}`}
            coordinate={{ latitude: member.qlat!, longitude: member.qlng! }}
            title={`👨‍👩‍👧‍👦 ${member.name}`}
            description={`Aile Üyesi - Son Görülme: ${member.lastSeen ? new Date(member.lastSeen).toLocaleString() : 'Bilinmiyor'}`}
            pinColor="green"
            onPress={() => handleMarkerPress({ 
              id: member.id, 
              lat: member.qlat!, 
              lon: member.qlng!, 
              ts: member.lastSeen || Date.now(), 
              kind: 'family',
              name: member.name, 
            })}
          />
        ))}
        
        {/* Offline Peers (BLE) */}
        {peers.map((peer) => (
          <ExpoMap.Marker
            key={`peer-${peer.id}`}
            coordinate={{ latitude: peer.lat, longitude: peer.lon }}
            title={peer.kind === 'trapped' ? `🚨 ${peer.name || peer.id}` : peer.kind === 'family' ? `👨‍👩‍👧‍👦 ${peer.name || peer.id}` : `👥 ${peer.name || peer.id}`}
            description={`${peer.kind === 'trapped' ? 'Enkaz Altı' : peer.kind === 'family' ? 'Aile' : 'Takım'} - Batarya: ${peer.batt || '?'}% - ${new Date(peer.ts).toLocaleTimeString()}`}
            pinColor={peer.kind === 'trapped' ? 'red' : peer.kind === 'family' ? 'green' : 'blue'}
            onPress={() => handleMarkerPress(peer)}
          />
        ))}

        {/* Offline Messaging Contacts */}
        {offlineContacts.map((contact) => (
          <ExpoMap.Marker
            key={`offline-contact-${contact.id}`}
            coordinate={{
              latitude: contact.lat || 39.9334,
              longitude: contact.lon || 32.8597
            }}
            title={`📡 ${contact.name}`}
            description={`BLE Mesh • ${contact.distance}m • ${contact.battery}% batarya • ${contact.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}`}
            pinColor={contact.isOnline ? "green" : "orange"}
            onPress={() => {
              Alert.alert(
                '📡 Offline Contact',
                `${contact.name}\n\nMesafe: ${contact.distance}m\nBatarya: ${contact.battery}%\nSon Görülme: ${new Date(contact.lastSeen).toLocaleTimeString()}\nDurum: ${contact.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}`,
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Mesaj Gönder',
                    onPress: async () => {
                      try {
                        await offlineMessaging.sendMessage(contact.id, 'Merhaba! Nasılsın?', 'text');
                        Alert.alert('Başarılı', 'Offline mesaj gönderildi!');
                      } catch (error) {
                        Alert.alert('Hata', 'Mesaj gönderilemedi');
                      }
                    }
                  }
                ]
              );
            }}
          />
        ))}
      </ExpoMap>
      
      {/* Overlays */}
      {center && <HeatGridOverlay w={width} h={height} center={center} scale={1/2} />}
      {trail.length>1 && <TrailOverlay pts={trail} speeds={speeds} w={width} h={height} />}

      {/* Enhanced Controls */}
      <Pressable onPress={onImportMbtiles} style={{ position:'absolute', right:16, top:64, backgroundColor:'#111827', padding:10, borderRadius:10 }}>
        <Text style={{ color:'white', fontWeight:'800' }}>.MBTILES</Text>
      </Pressable>

      {/* Offline Map Button */}
      <Pressable
        onPress={() => {
          // Navigate to offline map screen
          // This would require navigation prop or context
          Alert.alert('Offline Harita', 'Offline harita ekranına geçiliyor...');
        }}
        style={{ position:'absolute', right:16, top:110, backgroundColor:'#10b981', padding:10, borderRadius:10 }}
      >
        <Text style={{ color:'white', fontWeight:'800' }}>🗺️ OFFLINE</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(2)} style={{ position:'absolute', left:16, top:64, backgroundColor:'#111827', padding:10, borderRadius:10 }}>
        <Text style={{ color:'white' }}>2s</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(24)} style={{ position:'absolute', left:16, top:106, backgroundColor:'#111827', padding:10, borderRadius:10 }}>
        <Text style={{ color:'white' }}>24s</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(9999)} style={{ position:'absolute', left:16, top:148, backgroundColor:'#111827', padding:10, borderRadius:10 }}>
        <Text style={{ color:'white' }}>Tümü</Text>
      </Pressable>
      
      {/* Offline Features Controls */}
      <Pressable 
        onPress={broadcastMyLocation} 
        style={{ position:'absolute', right:16, top:110, backgroundColor:'#1e40af', padding:10, borderRadius:10 }}
      >
        <Text style={{ color:'white', fontWeight:'800' }}>📡 Konum Yayınla</Text>
      </Pressable>
      
      <Pressable 
        onPress={toggleTrappedMode} 
        style={{ position:'absolute', right:16, top:156, backgroundColor: trappedMode ? '#ef4444' : '#dc2626', padding:10, borderRadius:10 }}
      >
        <Text style={{ color:'white', fontWeight:'800' }}>{trappedMode ? '🚨 Enkaz Modu AKTİF' : '🚨 Enkaz Modu'}</Text>
      </Pressable>
      
      {/* Enhanced Info panel */}
      <View style={{ position:'absolute', top:60, left:16, backgroundColor:'rgba(17, 24, 39, 0.9)', padding:12, borderRadius:10, gap:4 }}>
        <Text style={{ color:'white', fontSize:12 }}>📍 {center ? `${center.lat.toFixed(6)}, ${center.lon.toFixed(6)}` : 'Konum alınıyor...'}</Text>
        <Text style={{ color:'white', fontSize:12 }}>{isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}</Text>
        <Text style={{ color:'white', fontSize:12 }}>📍 {pins.length} İşaret</Text>
        <Text style={{ color:'#10b981', fontSize:12 }}>👥 {peers.length} Yakındaki Kişi</Text>
        <Text style={{ color:'#3b82f6', fontSize:12 }}>👨‍👩‍👧‍👦 {familyMembers.length} Aile Üyesi</Text>
        {!isOnline && (
          <>
            <Text style={{ color:'#10b981', fontSize:12, fontWeight:'bold' }}>📡 BLE Mesh: {offlineStats.total} mesaj</Text>
            <Text style={{ color:'#10b981', fontSize:12 }}>👤 {offlineContacts.length} kişi • {offlineStats.sos} SOS</Text>
          </>
        )}
      </View>
      
      {/* GoToTarget Modal */}
      <Modal
        visible={showGoToTarget}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGoToTarget(false)}
      >
        {selectedTarget && (
          <GoToTarget
            target={selectedTarget}
            onClose={() => setShowGoToTarget(false)}
          />
        )}
      </Modal>
      
      {/* Trapped Mode Confirmation Alert */}
      <Modal
        visible={showTrappedAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTrappedAlert(false)}
      >
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center', padding:20 }}>
          <View style={{ backgroundColor:'#1f2937', padding:24, borderRadius:16, gap:16 }}>
            <Text style={{ color:'white', fontSize:20, fontWeight:'800', textAlign:'center' }}>🚨 Enkaz Modu</Text>
            <Text style={{ color:'#94a3b8', textAlign:'center' }}>
              Enkaz modu aktif edildiğinde:{'\n\n'}
              • 5 dakika hareketsiz kalırsanız otomatik SOS gönderilecek{'\n'}
              • Sesli ping başlatılacak{'\n'}
              • Ses algılama devreye girecek{'\n'}
              • Konumunuz BLE üzerinden yayınlanacak{'\n\n'}
              Devam etmek istiyor musunuz?
            </Text>
            <View style={{ flexDirection:'row', gap:12 }}>
              <Pressable 
                onPress={() => setShowTrappedAlert(false)} 
                style={{ flex:1, backgroundColor:'#6b7280', padding:12, borderRadius:8 }}
              >
                <Text style={{ color:'white', fontWeight:'600', textAlign:'center' }}>İptal</Text>
              </Pressable>
              <Pressable 
                onPress={confirmTrappedMode} 
                style={{ flex:1, backgroundColor:'#ef4444', padding:12, borderRadius:8 }}
              >
                <Text style={{ color:'white', fontWeight:'600', textAlign:'center' }}>Aktif Et</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
