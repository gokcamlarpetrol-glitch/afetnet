import { useState } from 'react';
import { logger } from '../utils/productionLogger';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCompass } from '../hooks/useCompass';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { bearingTo, haversineDistance } from '../lib/geo';

interface Target {
  lat: number;
  lon: number;
  label: string;
}

interface GoToTargetProps {
  target: Target;
  onClose?: () => void;
}

export default function GoToTarget({ target, onClose }: GoToTargetProps) {
  const [calibrated, setCalibrated] = useState(false);
  const [calibrationCount, setCalibrationCount] = useState(0);
  const { currentPos } = usePDRFuse();
  const compass = useCompass();

  const distance = currentPos ? haversineDistance(
    currentPos.lat, currentPos.lon,
    target.lat, target.lon
  ) : 0;

  const bearing = currentPos ? bearingTo(
    currentPos.lat, currentPos.lon,
    target.lat, target.lon
  ) : 0;

  const compassHeading = compass?.heading || 0;
  const relativeBearing = (bearing - compassHeading + 360) % 360;

  const getBearingArrow = (degrees: number): string => {
    const directions = [
      'K', 'K-KD', 'KD', 'D-KD', 'D', 'D-GD', 'GD', 'G-GD',
      'G', 'G-GB', 'GB', 'B-GB', 'B', 'B-KB', 'KB', 'K-KB'
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const getArrowSymbol = (degrees: number): string => {
    if (degrees < 22.5 || degrees >= 337.5) return '↑';
    if (degrees < 67.5) return '↗';
    if (degrees < 112.5) return '→';
    if (degrees < 157.5) return '↘';
    if (degrees < 202.5) return '↓';
    if (degrees < 247.5) return '↙';
    if (degrees < 292.5) return '←';
    return '↖';
  };

  const handleCalibrate = () => {
    setCalibrationCount(prev => prev + 1);
    if (calibrationCount >= 2) {
      setCalibrated(true);
      Alert.alert(
        'Pusula Kalibre Edildi',
        'Cihazı yavaşça 8 şeklinde hareket ettirin ve kalibrasyon tamamlandı.',
        [{ text: 'Tamam' }]
      );
    } else {
      Alert.alert(
        'Kalibrasyon',
        `${3 - calibrationCount} kez daha cihazı 360° çevirin.`,
        [{ text: 'Tamam' }]
      );
    }
  };

  const handleViewSatellite = () => {
    // This would open MapOffline in satellite mode centered on target
    Alert.alert(
      'Uydu Görünümü',
      'Harita uydu görünümünde açılacak.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Aç', onPress: () => {
          // TODO: Open map with satellite view
          logger.debug('Open satellite view for:', target);
        }}
      ]
    );
  };

  if (!currentPos) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Konum Bilgisi Gerekli</Text>
        <Text style={styles.subtitle}>
          Hedef: {target.label}
        </Text>
        <Text style={styles.errorText}>
          Konum bilgisi alınamadı. Lütfen konum izinlerini kontrol edin.
        </Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Kapat</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hedefe Yönel</Text>
      <Text style={styles.subtitle}>{target.label}</Text>

      <View style={styles.compassContainer}>
        <View style={styles.arrowContainer}>
          <Text style={styles.arrowSymbol}>
            {getArrowSymbol(relativeBearing)}
          </Text>
        </View>
        
        <View style={styles.directionInfo}>
          <Text style={styles.directionText}>
            {getBearingArrow(bearing)}
          </Text>
          <Text style={styles.distanceText}>
            ~{Math.round(distance)}m
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Hedef Koordinat:</Text>
          <Text style={styles.detailValue}>
            {target.lat.toFixed(6)}, {target.lon.toFixed(6)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Mevcut Koordinat:</Text>
          <Text style={styles.detailValue}>
            {currentPos.lat.toFixed(6)}, {currentPos.lon.toFixed(6)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pusula Yönü:</Text>
          <Text style={styles.detailValue}>
            {compassHeading.toFixed(0)}° ({getBearingArrow(compassHeading)})
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Kalibrasyon:</Text>
          <Text style={[styles.detailValue, calibrated ? styles.calibrated : styles.notCalibrated]}>
            {calibrated ? 'Tamamlandı' : 'Gerekli'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleCalibrate}
          style={[styles.actionButton, styles.calibrateButton]}
        >
          <Text style={styles.actionButtonText}>Pusula Kalibre Et</Text>
        </Pressable>

        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleViewSatellite}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Uyduyla Gör</Text>
        </Pressable>

        {onClose && (
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={onClose}
            style={[styles.actionButton, styles.closeButton]}
          >
            <Text style={styles.actionButtonText}>Kapat</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Kullanım Talimatları:</Text>
        <Text style={styles.instructionsText}>
          • Kırmızı ok hedef yönünü gösterir{'\n'}
          • Pusula kalibre edilmemişse önce kalibrasyon yapın{'\n'}
          • Cihazı hedef yönünde tutarak ilerleyin{'\n'}
          • Mesafe 50m altına düştüğünde dikkatli olun{'\n'}
          • Uydu görünümü ile çevreyi kontrol edin
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  compassContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  arrowContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#374151',
  },
  arrowSymbol: {
    fontSize: 48,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  directionInfo: {
    alignItems: 'center',
  },
  directionText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  distanceText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  calibrated: {
    color: '#10b981',
  },
  notCalibrated: {
    color: '#ef4444',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  calibrateButton: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  closeButton: {
    backgroundColor: '#6b7280',
    borderColor: '#6b7280',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
  },
  instructionsTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
});
