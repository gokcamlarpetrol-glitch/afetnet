import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { genKeyPair, generateSharedSecret } from '../lib/crypto';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

// Safe barcode scanner import with fallback for Expo Go
let BarCodeScanner: any = null;
let isExpoGo = false;

// Detect Expo Go environment FIRST
try {
  const Constants = require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
} catch (e) {
  // Ignore
}

// Only try to import barcode scanner if NOT in Expo Go
if (!isExpoGo) {
  try {
    const barcodeScanner = require('expo-barcode-scanner');
    BarCodeScanner = barcodeScanner.BarCodeScanner;
  } catch (e) {
    console.warn('expo-barcode-scanner not available, using fallback');
    isExpoGo = true;
  }
} else {
  console.warn('Expo Go detected - skipping barcode scanner import');
}

interface PairingData {
  deviceName: string;
  publicKey: string;
  timestamp: number;
}

export default function PairingQR() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [keyPair, setKeyPair] = useState<any>(null);
  const [deviceName, setDeviceName] = useState('');
  const [pairedDevices, setPairedDevices] = useState<PairingData[]>([]);

  useEffect(() => {
    initializePairing();
  }, []);

  const initializePairing = async () => {
    try {
      // Request camera permission (only if available)
      if (BarCodeScanner && !isExpoGo) {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } else {
        console.warn('BarCodeScanner not available - using mock mode');
        setHasPermission(false); // Mock mode
      }

      // Generate or load key pair
      let existingKeyPair = await AsyncStorage.getItem('pairing_keypair');
      if (existingKeyPair) {
        setKeyPair(JSON.parse(existingKeyPair));
      } else {
        const newKeyPair = genKeyPair();
        const keyPairData = {
          publicKey: Buffer.from(newKeyPair.publicKey).toString('base64'),
          secretKey: Buffer.from(newKeyPair.secretKey).toString('base64')
        };
        await AsyncStorage.setItem('pairing_keypair', JSON.stringify(keyPairData));
        setKeyPair(keyPairData);
      }

      // Load device name
      const savedName = await AsyncStorage.getItem('device_name');
      if (savedName) {
        setDeviceName(savedName);
      } else {
        const defaultName = `${Platform.OS === 'ios' ? 'iPhone' : 'Android'}_${Date.now().toString().slice(-4)}`;
        setDeviceName(defaultName);
        await AsyncStorage.setItem('device_name', defaultName);
      }

      // Load paired devices
      const paired = await AsyncStorage.getItem('paired_devices');
      if (paired) {
        setPairedDevices(JSON.parse(paired));
      }

    } catch (error) {
      console.error('Failed to initialize pairing:', error);
      Alert.alert('Hata', 'Eşleştirme başlatılamadı');
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    try {
      const pairingData: PairingData = JSON.parse(data);
      
      // Validate pairing data
      if (!pairingData.publicKey || !pairingData.deviceName || !pairingData.timestamp) {
        throw new Error('Geçersiz QR kod');
      }

      // Check if device is already paired
      const alreadyPaired = pairedDevices.some(device => device.publicKey === pairingData.publicKey);
      if (alreadyPaired) {
        Alert.alert('Bilgi', 'Bu cihaz zaten eşleştirilmiş');
        return;
      }

      // Generate shared secret
      const sharedSecret = generateSharedSecret(
        Buffer.from(keyPair.secretKey, 'base64'),
        pairingData.publicKey
      );

      // Store paired device
      const newPairedDevice = {
        ...pairingData,
        sharedSecret: Buffer.from(sharedSecret).toString('base64')
      };

      const updatedPairedDevices = [...pairedDevices, newPairedDevice];
      setPairedDevices(updatedPairedDevices);
      await AsyncStorage.setItem('paired_devices', JSON.stringify(updatedPairedDevices));

      Alert.alert(
        'Başarılı', 
        `${pairingData.deviceName} cihazı ile eşleştirme tamamlandı`,
        [{ text: 'Tamam', onPress: () => setScanned(false) }]
      );

    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Hata', 'QR kod okunamadı');
      setScanned(false);
    }
  };

  const generateQRData = (): PairingData => ({
    deviceName,
    publicKey: keyPair?.publicKey || '',
    timestamp: Date.now()
  });

  const removePairedDevice = async (publicKey: string) => {
    const updatedDevices = pairedDevices.filter(device => device.publicKey !== publicKey);
    setPairedDevices(updatedDevices);
    await AsyncStorage.setItem('paired_devices', JSON.stringify(updatedDevices));
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>Kamera İzni Bekleniyor</Text>
        </Card>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>Kamera İzni Gerekli</Text>
          <Text style={styles.description}>
            QR kod okumak için kamera iznine ihtiyaç var
          </Text>
          <Button label="İzin Ver" onPress={initializePairing} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.section}>
        <Text style={styles.title}>Cihaz Eşleştirme</Text>
        <Text style={styles.description}>
          Diğer AfetNet cihazları ile güvenli bağlantı kurmak için QR kod kullanın
        </Text>
      </Card>

      {/* Device Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Bu Cihaz</Text>
        <Text style={styles.infoText}>Cihaz Adı: {deviceName}</Text>
        <Text style={styles.infoText}>Anahtar: {keyPair?.publicKey?.slice(0, 16)}...</Text>
      </Card>

      {/* QR Scanner */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>QR Kod Okut</Text>
        <View style={styles.scannerContainer}>
          {BarCodeScanner && !isExpoGo ? (
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={styles.scanner}
            />
          ) : (
            <View style={styles.mockScanner}>
              <Text style={styles.mockScannerText}>
                QR Scanner not available in Expo Go{'\n'}
                Use development build for full functionality
              </Text>
            </View>
          )}
        </View>
        {scanned && (
          <Button 
            label="Tekrar Tara" 
            onPress={() => setScanned(false)}
            variant="ghost"
            style={styles.scanButton}
          />
        )}
      </Card>

      {/* Paired Devices */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Eşleştirilmiş Cihazlar</Text>
        {pairedDevices.length === 0 ? (
          <Text style={styles.emptyText}>Henüz eşleştirilmiş cihaz yok</Text>
        ) : (
          pairedDevices.map((device, index) => (
            <View key={index} style={styles.deviceItem}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.deviceName}</Text>
                <Text style={styles.deviceKey}>{device.publicKey.slice(0, 16)}...</Text>
              </View>
              <Button
                label="Kaldır"
                onPress={() => removePairedDevice(device.publicKey)}
                variant="danger"
                style={styles.removeButton}
              />
            </View>
          ))
        )}
      </Card>

      {/* Instructions */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Nasıl Kullanılır?</Text>
        <Text style={styles.instructionText}>
          1. Diğer cihazın QR kodunu okutun{'\n'}
          2. Cihazlar otomatik olarak eşleşir{'\n'}
          3. Şifreli mesajlaşma başlar{'\n'}
          4. SOS sinyalleri otomatik iletir
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    padding: spacing(2),
  },
  section: {
    marginBottom: spacing(2),
  },
  title: {
    color: palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing(1),
    textAlign: 'center',
  },
  sectionTitle: {
    color: palette.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing(1),
  },
  description: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  infoText: {
    color: palette.text.primary,
    fontSize: 14,
    marginBottom: spacing(0.5),
  },
  scannerContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing(1),
  },
  scanner: {
    flex: 1,
  },
  scanButton: {
    marginTop: spacing(1),
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  deviceKey: {
    color: palette.textDim,
    fontSize: 12,
  },
  removeButton: {
    paddingHorizontal: spacing(1),
  },
  emptyText: {
    color: palette.textDim,
    fontSize: 14,
    fontStyle: 'italic',
  },
  instructionText: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  mockScanner: {
    height: 200,
    backgroundColor: palette.backgroundDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.border,
    borderStyle: 'dashed',
  },
  mockScannerText: {
    color: palette.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
