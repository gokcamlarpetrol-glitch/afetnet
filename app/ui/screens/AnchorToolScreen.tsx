// @afetnet: Advanced Anchor Tool Screen for Dead Reckoning Calibration
// QR code placement and scanning for precise location anchoring

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { advancedDeadReckoningSystem } from '../../domain/nav/fusion/deadReckoning';
import { advancedTrilaterationSystem } from '../../domain/nav/fusion/trilateration';
import { logger } from '../../core/utils/logger';

interface AnchorPoint {
  id: string;
  name: string;
  position: { lat: number; lon: number; alt: number };
  qrCode: string;
  accuracy: number;
  timestamp: number;
  type: 'qr_code' | 'gps_fix' | 'manual';
}

export default function AnchorToolScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [anchorPoints, setAnchorPoints] = useState<AnchorPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [calibrationMode, setCalibrationMode] = useState<'scan' | 'place' | 'calibrate'>('scan');

  useEffect(() => {
    requestCameraPermission();
    loadCurrentLocation();
    loadAnchorPoints();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      logger.error('Camera permission request failed:', error);
    }
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        });
      }
    } catch (error) {
      logger.error('Failed to load current location:', error);
    }
  };

  const loadAnchorPoints = async () => {
    try {
      // Load stored anchor points
      const stored = await AsyncStorage.getItem('anchor_points');
      if (stored) {
        setAnchorPoints(JSON.parse(stored));
      }
    } catch (error) {
      logger.error('Failed to load anchor points:', error);
    }
  };

  const saveAnchorPoints = async (points: AnchorPoint[]) => {
    try {
      await AsyncStorage.setItem('anchor_points', JSON.stringify(points));
    } catch (error) {
      logger.error('Failed to save anchor points:', error);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;

    setScanned(true);
    setIsLoading(true);

    try {
      // Parse QR code data
      const qrData = JSON.parse(data);

      if (!qrData.id || !qrData.position) {
        throw new Error('Invalid QR code format');
      }

      // Get current GPS location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission required');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Create anchor point
      const anchorPoint: AnchorPoint = {
        id: qrData.id,
        name: qrData.name || `Anchor ${qrData.id.slice(-4)}`,
        position: {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          alt: location.coords.altitude || 0,
        },
        qrCode: data,
        accuracy: location.coords.accuracy || 10,
        timestamp: Date.now(),
        type: 'qr_code',
      };

      // Add to anchor points
      const updatedPoints = [...anchorPoints, anchorPoint];
      setAnchorPoints(updatedPoints);
      await saveAnchorPoints(updatedPoints);

      // Calibrate dead reckoning with this anchor
      advancedDeadReckoningSystem.addCalibrationPoint({
        position: anchorPoint.position,
        timestamp: anchorPoint.timestamp,
        accuracy: anchorPoint.accuracy,
        source: 'anchor',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '✅ Anchor Point Added',
        `${anchorPoint.name} anchor point added successfully!\n\nPosition: ${anchorPoint.position.lat.toFixed(6)}, ${anchorPoint.position.lon.toFixed(6)}\nAccuracy: ${anchorPoint.accuracy.toFixed(1)}m`,
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );

    } catch (error) {
      logger.error('Failed to process QR code:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        '❌ Error',
        'Failed to process QR code. Please try again.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const placeAnchorPoint = async () => {
    if (!currentLocation) {
      Alert.alert('Hata', 'Konum bilgisi alınamadı');
      return;
    }

    try {
      setIsLoading(true);

      const anchorId = `manual_${Date.now()}`;
      const anchorPoint: AnchorPoint = {
        id: anchorId,
        name: `Manual Anchor ${anchorId.slice(-4)}`,
        position: {
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          alt: 0, // Would get from altitude if available
        },
        qrCode: '', // No QR code for manual placement
        accuracy: 5, // Assume high accuracy for manual placement
        timestamp: Date.now(),
        type: 'manual',
      };

      // Add to anchor points
      const updatedPoints = [...anchorPoints, anchorPoint];
      setAnchorPoints(updatedPoints);
      await saveAnchorPoints(updatedPoints);

      // Calibrate dead reckoning
      advancedDeadReckoningSystem.addCalibrationPoint({
        position: anchorPoint.position,
        timestamp: anchorPoint.timestamp,
        accuracy: anchorPoint.accuracy,
        source: 'anchor',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '✅ Manual Anchor Added',
        `Manual anchor point added at:\n${anchorPoint.position.lat.toFixed(6)}, ${anchorPoint.position.lon.toFixed(6)}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      logger.error('Failed to place manual anchor:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata', 'Manual anchor placement failed');
    } finally {
      setIsLoading(false);
    }
  };

  const calibrateWithGPS = async () => {
    if (!currentLocation) {
      Alert.alert('Hata', 'Konum bilgisi alınamadı');
      return;
    }

    try {
      setIsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission required');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Create GPS anchor point
      const anchorPoint: AnchorPoint = {
        id: `gps_${Date.now()}`,
        name: `GPS Fix ${Date.now().toString().slice(-4)}`,
        position: {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          alt: location.coords.altitude || 0,
        },
        qrCode: '',
        accuracy: location.coords.accuracy || 10,
        timestamp: Date.now(),
        type: 'gps_fix',
      };

      // Add to anchor points
      const updatedPoints = [...anchorPoints, anchorPoint];
      setAnchorPoints(updatedPoints);
      await saveAnchorPoints(updatedPoints);

      // Calibrate dead reckoning
      advancedDeadReckoningSystem.addCalibrationPoint({
        position: anchorPoint.position,
        timestamp: anchorPoint.timestamp,
        accuracy: anchorPoint.accuracy,
        source: 'anchor',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '✅ GPS Calibration Added',
        `GPS calibration point added:\n${anchorPoint.position.lat.toFixed(6)}, ${anchorPoint.position.lon.toFixed(6)}\nAccuracy: ${anchorPoint.accuracy.toFixed(1)}m`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      logger.error('Failed to calibrate with GPS:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata', 'GPS calibration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const removeAnchorPoint = async (anchorId: string) => {
    try {
      const updatedPoints = anchorPoints.filter(point => point.id !== anchorId);
      setAnchorPoints(updatedPoints);
      await saveAnchorPoints(updatedPoints);

      Alert.alert('✅ Anchor Removed', 'Anchor point removed successfully');
    } catch (error) {
      logger.error('Failed to remove anchor:', error);
      Alert.alert('Hata', 'Failed to remove anchor point');
    }
  };

  const clearAllAnchors = async () => {
    try {
      setAnchorPoints([]);
      await saveAnchorPoints([]);

      Alert.alert('✅ All Anchors Cleared', 'All anchor points have been removed');
    } catch (error) {
      logger.error('Failed to clear anchors:', error);
      Alert.alert('Hata', 'Failed to clear anchor points');
    }
  };

  const getAnchorStats = () => {
    const qrAnchors = anchorPoints.filter(p => p.type === 'qr_code').length;
    const gpsAnchors = anchorPoints.filter(p => p.type === 'gps_fix').length;
    const manualAnchors = anchorPoints.filter(p => p.type === 'manual').length;

    const avgAccuracy = anchorPoints.length > 0
      ? anchorPoints.reduce((sum, p) => sum + p.accuracy, 0) / anchorPoints.length
      : 0;

    return {
      total: anchorPoints.length,
      qr: qrAnchors,
      gps: gpsAnchors,
      manual: manualAnchors,
      avgAccuracy,
    };
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Kamera izni kontrol ediliyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <Ionicons name="camera" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.errorMessage}>
            QR kod tarama için kamera izni gereklidir.
          </Text>
          <Pressable style={styles.retryButton} onPress={requestCameraPermission}>
            <Text style={styles.retryButtonText}>İzni Ver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const stats = getAnchorStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>📍 Anchor Tool</Text>
          <Text style={styles.subtitle}>Dead reckoning calibration points</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.tabButton} onPress={() => setCalibrationMode('scan')}>
            <Ionicons name="qr-code" size={20} color={calibrationMode === 'scan' ? '#10B981' : '#94A3B8'} />
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setCalibrationMode('place')}>
            <Ionicons name="location" size={20} color={calibrationMode === 'place' ? '#10B981' : '#94A3B8'} />
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setCalibrationMode('calibrate')}>
            <Ionicons name="construct" size={20} color={calibrationMode === 'calibrate' ? '#10B981' : '#94A3B8'} />
          </Pressable>
        </View>
      </View>

      {/* Mode Content */}
      {calibrationMode === 'scan' && (
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
          />

          {scanned && (
            <View style={styles.scannerOverlay}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.scannerText}>QR kod işleniyor...</Text>
            </View>
          )}

          <View style={styles.scannerInstructions}>
            <Text style={styles.instructionTitle}>QR Kod Tara</Text>
            <Text style={styles.instructionText}>
              Konum anchor noktası QR kodunu tarayın
            </Text>
          </View>
        </View>
      )}

      {calibrationMode === 'place' && (
        <ScrollView style={styles.contentContainer}>
          {/* Current Location */}
          {currentLocation && (
            <View style={styles.locationCard}>
              <Text style={styles.cardTitle}>📍 Mevcut Konum</Text>
              <Text style={styles.locationText}>
                {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
              </Text>
              <Pressable style={styles.actionButton} onPress={placeAnchorPoint} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionButtonText}>📍 Manuel Anchor Ekle</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* GPS Calibration */}
          <View style={styles.locationCard}>
            <Text style={styles.cardTitle}>🛰️ GPS Kalibrasyonu</Text>
            <Text style={styles.locationText}>
              Yüksek doğruluk GPS konumunu anchor olarak kaydet
            </Text>
            <Pressable style={styles.actionButton} onPress={calibrateWithGPS} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>🛰️ GPS Anchor Ekle</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}

      {calibrationMode === 'calibrate' && (
        <ScrollView style={styles.contentContainer}>
          {/* Anchor Points List */}
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>📊 Anchor İstatistikleri</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Toplam</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.qr}</Text>
                <Text style={styles.statLabel}>QR Kod</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.gps}</Text>
                <Text style={styles.statLabel}>GPS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.manual}</Text>
                <Text style={styles.statLabel}>Manuel</Text>
              </View>
            </View>
            <Text style={styles.avgAccuracy}>
              Ortalama Doğruluk: {stats.avgAccuracy.toFixed(1)}m
            </Text>
          </View>

          {/* Anchor Points */}
          {anchorPoints.map((anchor, index) => (
            <View key={anchor.id} style={styles.anchorCard}>
              <View style={styles.anchorHeader}>
                <View>
                  <Text style={styles.anchorName}>{anchor.name}</Text>
                  <Text style={styles.anchorType}>
                    {anchor.type === 'qr_code' ? '📱 QR Kod' :
                     anchor.type === 'gps_fix' ? '🛰️ GPS' : '📍 Manuel'}
                  </Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeAnchorPoint(anchor.id)}
                >
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </Pressable>
              </View>

              <Text style={styles.anchorPosition}>
                {anchor.position.lat.toFixed(6)}, {anchor.position.lon.toFixed(6)}
              </Text>
              <Text style={styles.anchorAccuracy}>
                Doğruluk: {anchor.accuracy.toFixed(1)}m • {new Date(anchor.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}

          {/* Clear All Button */}
          {anchorPoints.length > 0 && (
            <Pressable style={styles.clearButton} onPress={clearAllAnchors}>
              <Ionicons name="trash" size={20} color="#EF4444" />
              <Text style={styles.clearButtonText}>Tüm Anchor'ları Temizle</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  scannerInstructions: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  locationCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  avgAccuracy: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  anchorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  anchorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  anchorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  anchorType: {
    fontSize: 12,
    color: '#94A3B8',
  },
  anchorPosition: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  anchorAccuracy: {
    fontSize: 12,
    color: '#94A3B8',
  },
  removeButton: {
    padding: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 32,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});



















