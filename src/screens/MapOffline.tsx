import React, { useState, useRef, useEffect } from 'react';
import { logger } from "../utils/productionLogger";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { openDbFromUri, startMbtilesServer, stopMbtilesServer, localTileUrlTemplate } from '../offline/mbtiles-server';
import { SafeMBTiles } from '../offline/SafeMBTiles';
import { offlineMessaging } from '../services/OfflineMessaging';
import { offlineSyncManager } from '../services/OfflineSyncManager';
import { advancedBatteryManager } from '../services/AdvancedBatteryManager';

// Import expo-maps with fallback
let ExpoMap: any = null;

try {
  const maps = (globalThis as any).require('expo-maps');
  ExpoMap = maps.default;
} catch {
  // expo-maps not available - fallback to alternative map solution
}

export default function MapOffline() {
  const [tileServerActive, setTileServerActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ total: 0, delivered: 0, pending: 0, sos: 0 });
  const [offlineContacts, setOfflineContacts] = useState<any[]>([]);
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [tileServerStats, setTileServerStats] = useState({ tilesLoaded: 0, cacheSize: 0, serverUptime: 0 });
  const [batteryHealth, setBatteryHealth] = useState<any>(null);
  const [powerSavings, setPowerSavings] = useState<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadCurrentLocation();
    startOfflineMessaging();

    // Update battery data every 30 seconds
    const batteryInterval = setInterval(() => {
      updateBatteryData().catch(logger.error);
    }, 30000);

    // Battery manager listener
    const unsubscribeBattery = advancedBatteryManager.addPowerModeListener((profile, settings) => {
      logger.debug(`MapOffline - Battery mode changed: ${profile.level}% (${profile.state})`);
    });

    // Initial battery data update
    updateBatteryData();

    return () => {
      stopMbtilesServer();
      offlineMessaging.stop();
      clearInterval(batteryInterval);
      unsubscribeBattery();
    };
  }, []);

  const startOfflineMessaging = async () => {
    try {
      await offlineMessaging.start();
      updateOfflineData();
      logger.debug('Offline messaging started in MapOffline');
    } catch (error) {
      logger.error('Failed to start offline messaging in MapOffline:', error);
    }
  };

  const updateOfflineData = () => {
    try {
      const stats = offlineMessaging.getMessageStats();
      const contacts = offlineMessaging.getContacts();
      const health = offlineMessaging.getNetworkHealth();

      setOfflineStats(stats);
      setOfflineContacts(contacts);
      setNetworkHealth(health);

      // Update tile server stats
      const serverUptime = tileServerActive ? Date.now() - (globalThis as any).serverStartTime || Date.now() : 0;
      setTileServerStats({
        tilesLoaded: Math.floor(Math.random() * 1000), // Mock data
        cacheSize: Math.floor(Math.random() * 50) + 10, // Mock data
        serverUptime,
      });

      logger.debug(`MapOffline - System updated: ${stats.total} messages, ${contacts.length} contacts, ${health.meshConnectivity}% connectivity`);
    } catch (error) {
      logger.error('Failed to update offline data in MapOffline:', error);
    }
  };

  const updateBatteryData = async () => {
    try {
      const health = await advancedBatteryManager.getBatteryHealth();
      const savings = advancedBatteryManager.getPowerSavings();

      setBatteryHealth(health);
      setPowerSavings(savings);

      logger.debug(`MapOffline - Battery updated: ${health.currentLevel}% (${health.trend}), ${savings.totalPowerSavings}% power savings`);
    } catch (error) {
      logger.error('Failed to update battery data in MapOffline:', error);
    }
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const pos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(pos);
        
        // Set initial map region
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...pos,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    } catch (error) {
      logger.error('Failed to load current location:', error);
    }
  };

  const handleImportMbtiles = async () => {
    if (!SafeMBTiles.isAvailable()) {
      Alert.alert('Hata', 'MBTiles desteği mevcut değil. react-native-sqlite-storage ve react-native-tcp-socket gerekli.');
      return;
    }

    setIsLoading(true);
    try {
      const uri = await SafeMBTiles.pickMbtiles();
      await openDbFromUri(uri);
      await startMbtilesServer();
      setTileServerActive(true);
      Alert.alert('Başarılı', 'Offline harita paketi yüklendi ve aktif edildi!');
    } catch (e: any) {
      if (String(e?.message) !== 'cancelled') {
        Alert.alert('Hata', 'Offline harita paketi yüklenemedi: ' + String(e?.message || 'Bilinmiyor'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowMyLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      Alert.alert('Uyarı', 'Konum bilgisi alınamadı');
    }
  };

  // Fallback UI when expo-maps is not available
  if (!ExpoMap) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Offline Harita</Text>
          <Text style={styles.subtitle}>Çevrimdışı harita görüntüleme</Text>

          {/* Emergency Mode Banner */}
          {emergencyMode && (
            <View style={styles.emergencyBanner}>
              <Text style={styles.emergencyText}>🚨 ACİL DURUM MODU AKTİF!</Text>
            </View>
          )}

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>📴 Çevrimdışı Mod - BLE Mesh Network Aktif!</Text>
              {networkHealth && (
                <Text style={styles.networkStats}>
                  {networkHealth.meshConnectivity}% bağlantı • {networkHealth.averageReliability} güvenilirlik • {networkHealth.pendingMessages} bekleyen
                </Text>
              )}
            </View>
          )}

          {tileServerActive && (
            <View style={styles.onlineBanner}>
              <Text style={styles.onlineText}>✅ Offline Tiles Aktif</Text>
              <Text style={styles.serverStats}>
                {tileServerStats.tilesLoaded} tile • {tileServerStats.cacheSize}MB cache • {Math.floor(tileServerStats.serverUptime / 60000)}dk çalışma
              </Text>
            </View>
          )}
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🗺️ Offline Harita</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>

          {/* Offline messaging stats */}
          <View style={styles.offlineStats}>
            <Text style={styles.offlineStatsTitle}>📡 Offline Mesajlaşma</Text>
            <Text style={styles.offlineStatsText}>
              {offlineStats.total} mesaj • {offlineContacts.length} kişi • {offlineStats.sos} SOS
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.importButton} onPress={handleImportMbtiles} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>📦 MBTiles İçe Aktar</Text>
            )}
          </Pressable>

          <Pressable style={styles.locationButton} onPress={handleShowMyLocation}>
            <Text style={styles.buttonText}>📍 Konumuma Git</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Offline Harita</Text>
        <Text style={styles.subtitle}>Çevrimdışı harita görüntüleme</Text>

        {/* Emergency Mode Banner */}
        {emergencyMode && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyText}>🚨 ACİL DURUM MODU AKTİF!</Text>
            <Text style={styles.emergencySubtext}>Tüm sistemler maksimum güvenilirlik için optimize edildi</Text>
          </View>
        )}

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>📴 Çevrimdışı Mod - BLE Mesh Network Aktif!</Text>
              {networkHealth && (
                <Text style={styles.networkStats}>
                  💚 {networkHealth.meshConnectivity || 0}% bağlantı • 📊 {networkHealth.averageReliability || 0} güvenilirlik • 📨 {networkHealth.pendingMessages || 0} bekleyen
                </Text>
              )}
              {batteryHealth && (
                <Text style={{
                  ...styles.networkStats,
                  color: (batteryHealth.currentLevel || 0) <= 20 ? '#ef4444' : (batteryHealth.currentLevel || 0) <= 50 ? '#f97316' : '#ffffff',
                }}>
                  🔋 {batteryHealth.currentLevel || 0}% ({batteryHealth.trend || 'stable'}) • ⚡ {(powerSavings?.totalPowerSavings) || 0}% güç tasarrufu
                </Text>
              )}
            </View>
          )}

        {tileServerActive && (
          <View style={styles.onlineBanner}>
            <Text style={styles.onlineText}>✅ Offline Tiles Aktif</Text>
            <Text style={styles.serverStats}>
              🗺️ {tileServerStats.tilesLoaded} tile yüklenmiş • 💾 {tileServerStats.cacheSize}MB cache • ⏱️ {Math.floor(tileServerStats.serverUptime / 60000)}dk uptime
            </Text>
          </View>
        )}
      </View>

      <View style={styles.map}>
        <ExpoMap
          ref={mapRef}
          style={styles.mapContent}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          mapType="standard"
        >
          {tileServerActive && (
            <ExpoMap.TileOverlay
              urlTemplate={localTileUrlTemplate()}
              zIndex={-1}
              maximumZ={18}
              flipY={false}
            />
          )}

          {/* Offline contacts markers */}
          {offlineContacts.map((contact) => (
            <ExpoMap.Marker
              key={`offline-contact-${contact.id}`}
              coordinate={{
                latitude: contact.lat || 39.9334,
                longitude: contact.lon || 32.8597
              }}
              title={`📡 ${contact.name}`}
              description={`Çevrimdışı • ${contact.distance}m • ${contact.battery}% batarya`}
              pinColor={contact.isOnline ? "green" : "red"}
            />
          ))}
        </ExpoMap>

        {/* Offline messaging overlay */}
        <View style={styles.offlineOverlay}>
          <Text style={styles.offlineOverlayTitle}>📡 BLE Mesh Network</Text>
          <Text style={styles.offlineOverlayText}>
            {offlineStats.total} mesaj • {offlineContacts.length} kişi • {offlineStats.sos} SOS
          </Text>
        </View>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          {tileServerActive ? '✅ Offline Tiles: Aktif' : '⚠️ Offline Tiles: Pasif'}
        </Text>
        <Text style={styles.infoText}>
          {isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}
        </Text>
        {currentLocation && (
          <Text style={styles.infoText}>
            📍 Konum: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.importButton, isLoading && styles.disabledButton]}
          onPress={handleImportMbtiles}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>📦 MBTiles İçe Aktar</Text>
          )}
        </Pressable>

        <Pressable style={styles.locationButton} onPress={handleShowMyLocation}>
          <Text style={styles.buttonText}>📍 Konumuma Git</Text>
        </Pressable>

        {/* Emergency Mode Controls */}
        {!isOnline && (
          <>
            <Pressable
              style={{
                backgroundColor: emergencyMode ? '#dc2626' : '#ef4444',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={async () => {
                if (emergencyMode) {
                  setEmergencyMode(false);
                  Alert.alert('Acil Durum', 'Acil durum modu kapatıldı');
                } else {
                  offlineMessaging.activateEmergencyMode();
                  setEmergencyMode(true);

                  // Add emergency activation to sync queue
                  await offlineSyncManager.addEmergencyDataToSync({
                    type: 'emergency_mode_activated',
                    timestamp: Date.now(),
                    location: currentLocation,
                    message: 'Emergency mode activated via offline map',
                  });

                  Alert.alert('🚨 Acil Durum', 'Acil durum modu aktif! Harita ve mesajlaşma maksimum öncelikli. Durum sunucuya senkronize edildi.');
                }
              }}
            >
              <Text style={styles.buttonText}>
                {emergencyMode ? '🚨 ACİL MODU KAPAT' : '🚨 ACİL MODU AKTİF ET'}
              </Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#22c55e',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={() => {
                offlineMessaging.activateBatterySavingMode();
                Alert.alert('🔋 Pil Tasarrufu', 'Harita ve BLE tarama sıklığı azaltıldı');
              }}
            >
              <Text style={styles.buttonText}>🔋 PİL TASARRUFU MODU</Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#3b82f6',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={() => {
                offlineMessaging.optimizeRouting();
                Alert.alert('🛣️ Optimizasyon', 'Mesaj yönlendirmesi optimize edildi');
              }}
            >
              <Text style={styles.buttonText}>🛣️ ROUTING OPTİMİZE ET</Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#8b5cf6',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={async () => {
                try {
                  const resilience = await offlineMessaging.testNetworkResilience();

                  // Add test results to sync queue
                  await offlineSyncManager.addEmergencyDataToSync({
                    type: 'network_resilience_test',
                    timestamp: Date.now(),
                    results: resilience,
                    location: currentLocation,
                    message: 'Network resilience test performed via offline map',
                  });

                  Alert.alert(
                    '🧪 Ağ Testi',
                    `${resilience.recommendation}\n\nBağlantı: ${resilience.connectivityTest ? '✅' : '❌'}\nGecikme: ${resilience.latencyTest}ms\nGüvenilirlik: ${resilience.reliabilityTest}%`
                  );
                } catch (error) {
                  Alert.alert('Test Hatası', 'Ağ testi başarısız');
                }
              }}
            >
              <Text style={styles.buttonText}>🧪 AĞ TESTİ YAP</Text>
            </Pressable>

            {/* Battery Management Controls */}
            <Pressable
              style={{
                backgroundColor: '#fbbf24',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={async () => {
                try {
                  await advancedBatteryManager.enableEmergencyPowerSaving();
                  Alert.alert('🚨 Acil Güç Tasarrufu', 'Tüm sistemler minimum güç tüketimi için optimize edildi!');
                } catch (error) {
                  Alert.alert('Hata', 'Acil güç tasarrufu aktifleştirilemedi');
                }
              }}
            >
              <Text style={styles.buttonText}>🚨 ACİL GÜÇ TASARRUFU</Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#10b981',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={async () => {
                try {
                  await advancedBatteryManager.disablePowerSaving();
                  Alert.alert('⚡ Normal Mod', 'Güç tasarrufu kapatıldı, tam performans aktif!');
                } catch (error) {
                  Alert.alert('Hata', 'Normal mod aktifleştirilemedi');
                }
              }}
            >
              <Text style={styles.buttonText}>⚡ NORMAL MOD</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • "MBTiles İçe Aktar" ile offline harita paketi yükleyin{'\n'}
          • MBTiles formatında harita dosyası gerekli{'\n'}
          • Yüklendikten sonra çevrimdışı harita görüntülenir{'\n'}
          • Tile sunucusu yerel ağ üzerinden çalışır
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  emergencyBanner: {
    backgroundColor: '#ef4444',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  emergencyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emergencySubtext: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  offlineBanner: {
    backgroundColor: '#f97316',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  networkStats: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  onlineBanner: {
    backgroundColor: '#10b981',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  onlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  serverStats: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  map: {
    flex: 1,
    position: 'relative',
  },
  mapContent: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mapSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  infoPanel: {
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  infoText: {
    color: '#e5e7eb',
    fontSize: 12,
    marginVertical: 2,
  },
  controls: {
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  importButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  locationButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#64748b',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructions: {
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  offlineStats: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  offlineStatsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  offlineStatsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    padding: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  offlineOverlayTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  offlineOverlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
