import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Dimensions } from 'react-native';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { computeWeightedCentroid, RSSISample, combineEstimates } from '../algorithms/rssiGradient';
import { meshRelay } from '../services/mesh/relay';

const { width } = Dimensions.get('window');

export interface MissionTarget {
  id: string;
  lat: number;
  lon: number;
  timestamp: number;
  statuses?: string[];
}

interface CoveragePoint {
  lat: number;
  lon: number;
  timestamp: number;
  confidence: number;
}

export default function Mission({ target }: { target?: MissionTarget }) {
  const [direction, setDirection] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [coveragePoints, setCoveragePoints] = useState<CoveragePoint[]>([]);
  const [rssiSamples, setRssiSamples] = useState<RSSISample[]>([]);
  const [statusFlags, setStatusFlags] = useState({
    sound: false,
    noSound: false,
    listening: false,
    unsafe: false
  });

  const { heading, currentPos } = usePDRFuse();
  const scanIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (target && currentPos) {
      calculateDirectionAndDistance();
    }
  }, [target, currentPos]);

  useEffect(() => {
    if (isScanning) {
      startGridScan();
    } else {
      stopGridScan();
    }

    return () => stopGridScan();
  }, [isScanning]);

  const calculateDirectionAndDistance = () => {
    if (!target || !currentPos) return;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = currentPos.lat * Math.PI / 180;
    const φ2 = target.lat * Math.PI / 180;
    const Δφ = (target.lat - currentPos.lat) * Math.PI / 180;
    const Δλ = (target.lon - currentPos.lon) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const dist = R * c; // Distance in meters
    setDistance(dist);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    const relativeAngle = ((bearing - heading + 360) % 360);
    setDirection(relativeAngle);
  };

  const startGridScan = () => {
    scanIntervalRef.current = setInterval(() => {
      if (currentPos) {
        // Simulate RSSI samples (in real implementation, get from BLE relay)
        const simulatedSample: RSSISample = {
          rssi: -60 - Math.random() * 40, // -60 to -100 dBm
          lat: currentPos.lat + (Math.random() - 0.5) * 0.001,
          lon: currentPos.lon + (Math.random() - 0.5) * 0.001,
          timestamp: Date.now(),
          deviceId: target?.id || 'unknown'
        };

        setRssiSamples(prev => [...prev.slice(-50), simulatedSample]);

        // Add coverage point
        const coveragePoint: CoveragePoint = {
          lat: currentPos.lat,
          lon: currentPos.lon,
          timestamp: Date.now(),
          confidence: 0.7
        };

        setCoveragePoints(prev => [...prev, coveragePoint]);
      }
    }, 1000);
  };

  const stopGridScan = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = undefined;
    }
  };

  const toggleStatusFlag = (flag: keyof typeof statusFlags) => {
    setStatusFlags(prev => ({
      ...prev,
      [flag]: !prev[flag]
    }));

    // Send confirmation via mesh
    if (target) {
      meshRelay.ack(target.id);
    }
  };

  const sendGoingStatus = () => {
    if (target) {
      meshRelay.ack(target.id);
      Alert.alert('Durum Gönderildi', 'GİDİYORUM durumu gönderildi');
    }
  };

  const getLocationEstimate = () => {
    if (rssiSamples.length === 0) return null;
    
    const recentSamples = rssiSamples.filter(s => 
      Date.now() - s.timestamp < 30000
    );

    if (recentSamples.length === 0) return null;

    return computeWeightedCentroid(recentSamples);
  };

  const locationEstimate = getLocationEstimate();

  if (!target) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Görev Modu</Text>
        <Text style={styles.subtitle}>Aktif SOS hedefi bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Görev: Hedef {target.id.slice(-6)}</Text>
      
      {/* Direction & Distance */}
      <View style={styles.directionContainer}>
        <View style={styles.arrowContainer}>
          <View 
            style={[
              styles.arrow,
              { transform: [{ rotate: `${direction}deg` }] }
            ]}
          >
            <Text style={styles.arrowText}>➤</Text>
          </View>
        </View>
        <Text style={styles.distanceText}>
          ~{Math.round(distance)}m
        </Text>
        <Text style={styles.confidenceText}>
          Güven: {locationEstimate ? Math.round(locationEstimate.confidence * 100) : 0}%
        </Text>
      </View>

      {/* Grid Scan Controls */}
      <View style={styles.controlsContainer}>
        <Text style={styles.sectionTitle}>Grid Tarama</Text>
        <View style={styles.scanControls}>
          <Pressable
            onPress={() => setIsScanning(!isScanning)}
            style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          >
            <Text style={styles.scanButtonText}>
              {isScanning ? 'Durdur' : 'Kuzey-Güney / Doğu-Batı'}
            </Text>
          </Pressable>
        </View>
        
        {coveragePoints.length > 0 && (
          <Text style={styles.coverageText}>
            Kapsam: {coveragePoints.length} nokta
          </Text>
        )}
      </View>

      {/* Status Flags */}
      <View style={styles.statusContainer}>
        <Text style={styles.sectionTitle}>Durum İşaretleri</Text>
        <View style={styles.statusGrid}>
          {Object.entries(statusFlags).map(([key, value]) => (
            <Pressable
              key={key}
              onPress={() => toggleStatusFlag(key as keyof typeof statusFlags)}
              style={[
                styles.statusButton,
                value && styles.statusButtonActive
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                value && styles.statusButtonTextActive
              ]}>
                {getStatusLabel(key)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Going Status */}
      <Pressable
        onPress={sendGoingStatus}
        style={styles.goingButton}
      >
        <Text style={styles.goingButtonText}>GİDİYORUM</Text>
      </Pressable>

      {/* Heat Map Info */}
      {locationEstimate && (
        <View style={styles.heatMapContainer}>
          <Text style={styles.sectionTitle}>Kapsam Isı Haritası</Text>
          <Text style={styles.heatMapText}>
            Tahmini konum: {locationEstimate.lat.toFixed(6)}, {locationEstimate.lon.toFixed(6)}
          </Text>
          <Text style={styles.heatMapText}>
            Kullanılan örnek: {locationEstimate.samplesUsed}
          </Text>
        </View>
      )}
    </View>
  );
}

function getStatusLabel(key: string): string {
  switch (key) {
    case 'sound': return 'Ses var';
    case 'noSound': return 'Ses yok';
    case 'listening': return 'Dinleme yapıldı';
    case 'unsafe': return 'Güvenli değil';
    default: return key;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  directionContainer: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 16,
  },
  arrowContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrow: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 48,
    color: '#3b82f6',
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  confidenceText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  controlsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scanControls: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonActive: {
    backgroundColor: '#3b82f6',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  coverageText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  statusButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  goingButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  goingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  heatMapContainer: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
  },
  heatMapText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
});
