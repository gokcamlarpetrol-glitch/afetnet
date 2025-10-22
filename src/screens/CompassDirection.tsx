import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCompass } from '../hooks/useCompass';
import { bearingTo, haversineDistance } from '../lib/geo';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

const { width } = Dimensions.get('window');

interface CompassDirectionProps {
  visible: boolean;
  onClose: () => void;
  target: { lat: number; lon: number };
  currentPosition: { lat: number; lon: number } | null;
}

export default function CompassDirection({ visible, onClose, target, currentPosition }: CompassDirectionProps) {
  const [heading, setHeading] = useState(0);
  const { heading: compassHeading } = useCompass();

  useEffect(() => {
    setHeading(compassHeading);
  }, [compassHeading]);

  if (!currentPosition) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <Card style={styles.container}>
            <Text style={styles.title}>Pusula</Text>
            <Text style={styles.errorText}>Konum bilgisi alınamadı</Text>
            <Button label="Kapat" onPress={onClose} />
          </Card>
        </View>
      </Modal>
    );
  }

  const distance = haversineDistance(currentPosition.lat, currentPosition.lon, target.lat, target.lon);
  const bearing = bearingTo(currentPosition.lat, currentPosition.lon, target.lat, target.lon);
  const relativeAngle = (bearing - heading + 360) % 360;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Card style={styles.container}>
          <Text style={styles.title}>Yön Bulma</Text>
          
          {/* Distance and bearing info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mesafe:</Text>
            <Text style={styles.infoValue} accessibilityLabel={`Hedefe mesafe ${Math.round(distance)} metre`}>
              {Math.round(distance)} m
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kuzeyden Açı:</Text>
            <Text style={styles.infoValue} accessibilityLabel={`Hedef kuzeyden ${Math.round(bearing)} derece`}>
              {Math.round(bearing)}°
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mevcut Yön:</Text>
            <Text style={styles.infoValue} accessibilityLabel={`Şu anda ${Math.round(heading)} derece yönündesiniz`}>
              {Math.round(heading)}°
            </Text>
          </View>

          {/* Compass arrow */}
          <View style={styles.compassContainer} accessibilityLabel={`Yön oku ${getDirectionText(relativeAngle)} yönünü gösteriyor`}>
            <View 
              style={[
                styles.arrow, 
                { transform: [{ rotate: `${relativeAngle}deg` }] },
              ]} 
            />
            <View style={styles.compassCenter} />
          </View>

          {/* Direction text */}
          <Text style={styles.directionText} accessibilityRole="text" accessibilityLabel={`Hedef yönü: ${getDirectionText(relativeAngle)}`}>
            {getDirectionText(relativeAngle)}
          </Text>

          <Button label="Kapat" onPress={onClose} style={styles.closeButton} />
        </Card>
      </View>
    </Modal>
  );
}

function getDirectionText(angle: number): string {
  if (angle < 22.5 || angle >= 337.5) return 'Kuzey';
  if (angle < 67.5) return 'Kuzeydoğu';
  if (angle < 112.5) return 'Doğu';
  if (angle < 157.5) return 'Güneydoğu';
  if (angle < 202.5) return 'Güney';
  if (angle < 247.5) return 'Güneybatı';
  if (angle < 292.5) return 'Batı';
  return 'Kuzeybatı';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    color: palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing(2),
  },
  errorText: {
    color: palette.error.main,
    fontSize: 16,
    marginBottom: spacing(2),
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing(1),
  },
  infoLabel: {
    color: palette.textDim,
    fontSize: 16,
  },
  infoValue: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  compassContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing(3),
    position: 'relative',
  },
  arrow: {
    width: 4,
    height: 80,
    backgroundColor: palette.primary.main,
    position: 'absolute',
    borderRadius: 2,
    shadowColor: palette.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  compassCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.primary.main,
    borderWidth: 2,
    borderColor: palette.bg,
  },
  directionText: {
    color: palette.primary.main,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing(2),
  },
  closeButton: {
    width: '100%',
  },
});
