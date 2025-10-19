import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

// Import expo-maps with fallback
let ExpoMap: any = null;
let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;

try {
  const maps = require('expo-maps');
  ExpoMap = maps.default;
  MapView = maps.MapView;
  Polyline = maps.Polyline;
  Marker = maps.Marker;
} catch (e) {
  // expo-maps not available - fallback to alternative map solution
}

interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  notes?: string;
}

export default function RouteEditorScreen() {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(null);
  const [pointName, setPointName] = useState('');
  const [pointNotes, setPointNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Initialize with current location
    loadCurrentLocation();
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const currentPos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        // Set initial map region
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...currentPos,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'Konum alınamadı');
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    const newPoint: RoutePoint = {
      id: `point_${Date.now()}`,
      latitude,
      longitude,
      name: `Nokta ${routePoints.length + 1}`,
      notes: '',
    };
    
    setRoutePoints([...routePoints, newPoint]);
    setSelectedPoint(newPoint);
    setPointName(newPoint.name || '');
    setPointNotes('');
    setIsEditing(true);
  };

  const handleSavePoint = () => {
    if (!selectedPoint) return;
    
    const updatedPoints = routePoints.map(point =>
      point.id === selectedPoint.id
        ? { ...point, name: pointName, notes: pointNotes }
        : point
    );
    
    setRoutePoints(updatedPoints);
    setIsEditing(false);
    setSelectedPoint(null);
    Alert.alert('Başarılı', 'Nokta kaydedildi');
  };

  const handleDeletePoint = (pointId: string) => {
    Alert.alert(
      'Nokta Sil',
      'Bu noktayı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            setRoutePoints(routePoints.filter(p => p.id !== pointId));
            if (selectedPoint?.id === pointId) {
              setSelectedPoint(null);
              setIsEditing(false);
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Tümünü Temizle',
      'Tüm rotayı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => {
            setRoutePoints([]);
            setSelectedPoint(null);
            setIsEditing(false);
          },
        },
      ]
    );
  };

  const handleSaveRoute = async () => {
    if (routePoints.length < 2) {
      Alert.alert('Uyarı', 'En az 2 nokta gerekli');
      return;
    }
    
    setIsLoading(true);
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Başarılı', 'Rota kaydedildi');
    } catch (error) {
      Alert.alert('Hata', 'Rota kaydedilemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalDistance = (): number => {
    if (routePoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];
      
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (p1.latitude * Math.PI) / 180;
      const φ2 = (p2.latitude * Math.PI) / 180;
      const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
      const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      totalDistance += R * c;
    }
    
    return totalDistance;
  };

  const totalDistance = calculateTotalDistance();

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>✏️ Rota Düzenleyici</Text>
          <Text style={styles.subtitle}>Özel rotalar oluşturun</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>✏️ Rota Düzenleyici</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.saveButton} onPress={handleSaveRoute}>
            <Text style={styles.buttonText}>💾 Rotayı Kaydet</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>✏️ Rota Düzenleyici</Text>
        <Text style={styles.subtitle}>Özel rotalar oluşturun</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📴 Çevrimdışı Mod</Text>
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        mapType="standard"
      >
        {routePoints.map((point, index) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={point.name}
            description={point.notes}
            pinColor={index === 0 ? 'green' : index === routePoints.length - 1 ? 'red' : 'blue'}
            onPress={() => {
              setSelectedPoint(point);
              setPointName(point.name || '');
              setPointNotes(point.notes || '');
              setIsEditing(true);
            }}
          />
        ))}
        
        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeColor="#2196F3"
            strokeWidth={4}
          />
        )}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          📍 Nokta Sayısı: {routePoints.length}
        </Text>
        {totalDistance > 0 && (
          <Text style={styles.infoText}>
            📏 Toplam Mesafe: {totalDistance.toFixed(0)}m ({(totalDistance / 1000).toFixed(2)}km)
          </Text>
        )}
      </View>

      {isEditing && selectedPoint && (
        <View style={styles.editorPanel}>
          <ScrollView style={styles.editorContent}>
            <Text style={styles.editorLabel}>Nokta Adı:</Text>
            <TextInput
              style={styles.input}
              value={pointName}
              onChangeText={setPointName}
              placeholder="Nokta adını girin"
              placeholderTextColor="#94a3b8"
            />
            
            <Text style={styles.editorLabel}>Notlar:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={pointNotes}
              onChangeText={setPointNotes}
              placeholder="Notlar ekleyin"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.editorActions}>
              <Pressable style={styles.saveButton} onPress={handleSavePoint}>
                <Text style={styles.buttonText}>💾 Kaydet</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeletePoint(selectedPoint.id)}
              >
                <Text style={styles.deleteButtonText}>🗑️ Sil</Text>
              </Pressable>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setSelectedPoint(null);
                }}
              >
                <Text style={styles.cancelButtonText}>❌ İptal</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}

      <View style={styles.controls}>
        <Pressable
          style={[styles.saveRouteButton, routePoints.length < 2 && styles.disabledButton]}
          onPress={handleSaveRoute}
          disabled={routePoints.length < 2 || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>💾 Rotayı Kaydet</Text>
          )}
        </Pressable>
        
        <Pressable
          style={[styles.clearButton, routePoints.length === 0 && styles.disabledButton]}
          onPress={handleClearAll}
          disabled={routePoints.length === 0}
        >
          <Text style={styles.clearButtonText}>🗑️ Tümünü Temizle</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • Haritaya dokunarak nokta ekleyin{'\n'}
          • Noktalara dokunarak düzenleyin{'\n'}
          • Nokta adı ve notlar ekleyin{'\n'}
          • Rotayı kaydedin ve paylaşın
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
  map: {
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
  editorPanel: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    maxHeight: 300,
  },
  editorContent: {
    padding: 16,
  },
  editorLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controls: {
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  saveRouteButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#ef4444',
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
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
});
