import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, Pressable, Dimensions } from 'react-native';
import { SafeBarcodeScanner } from '../ui/SafeBarcodeScanner';
import { useFamily } from '../store/family';
import { logger } from '../utils/productionLogger';

const { width, height } = Dimensions.get('window');

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { addByQR } = useFamily();

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await SafeBarcodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    setIsScanning(false);
    
    try {
      logger.info('QR Code scanned', { type, data: data.substring(0, 50) + '...' });
      
      // Parse QR data
      const qrData = JSON.parse(data);
      
      if (qrData.type === 'family_member') {
        const result = await addByQR(qrData);
        if (result.success) {
          Alert.alert('Başarılı', 'Aile üyesi eklendi');
        } else {
          Alert.alert('Hata', result.error || 'QR kod işlenemedi');
        }
      } else if (qrData.type === 'emergency_contact') {
        Alert.alert('Acil Durum İletişimi', 'Acil durum iletişim bilgisi alındı');
      } else {
        Alert.alert('QR Kod', `Tür: ${qrData.type}\nVeri: ${JSON.stringify(qrData)}`);
      }
    } catch (error) {
      logger.error('QR Code parsing error:', error);
      Alert.alert('Hata', 'Geçersiz QR kod formatı');
    }
  };

  const startScanning = () => {
    setScanned(false);
    setIsScanning(true);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Kamera izni isteniyor...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Kamera erişimi reddedildi</Text>
        <Pressable style={styles.button} onPress={() => {
          SafeBarcodeScanner.requestPermissionsAsync().then(({ status }) => {
            setHasPermission(status === 'granted');
          });
        }}>
          <Text style={styles.buttonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 QR Kod Tarayıcı</Text>
        <Text style={styles.subtitle}>
          {isScanning ? 'QR kodu kameraya gösterin' : 'Tarama için başlat butonuna basın'}
        </Text>
      </View>

      {isScanning ? (
        <View style={styles.scannerContainer}>
          {/* If scanner is unavailable (e.g., Expo Go), show placeholder area */}
          {SafeBarcodeScanner.isAvailable() ? (
            // @ts-ignore - rendered component provided by native module when available
            <SafeBarcodeScanner.Component
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={styles.scanner}
              barCodeTypes={[SafeBarcodeScanner.Constants.BarCodeType.qr]}
            />
          ) : (
            <View style={[styles.scanner, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#999' }}>QR tarayıcı bu ortamda devre dışı</Text>
            </View>
          )}
          
          {/* Scanner overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
            <Text style={styles.scanText}>QR kodu bu alana hizalayın</Text>
          </View>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>📷</Text>
          <Text style={styles.placeholderTitle}>QR Kod Tarayıcı</Text>
          <Text style={styles.placeholderSubtitle}>
            Aile üyesi eklemek veya acil durum iletişimi için QR kod tarayabilirsiniz
          </Text>
        </View>
      )}

      <View style={styles.controls}>
        {!isScanning ? (
          <Pressable style={styles.startButton} onPress={startScanning}>
            <Text style={styles.buttonText}>▶️ Taramayı Başlat</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={stopScanning}>
            <Text style={styles.buttonText}>⏹️ Taramayı Durdur</Text>
          </Pressable>
        )}
        
        {scanned && (
          <Pressable style={styles.scanAgainButton} onPress={() => setScanned(false)}>
            <Text style={styles.buttonText}>🔄 Tekrar Tara</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Desteklenen QR Kod Türleri:</Text>
        <Text style={styles.infoItem}>• Aile üyesi bilgileri</Text>
        <Text style={styles.infoItem}>• Acil durum iletişim bilgileri</Text>
        <Text style={styles.infoItem}>• AfetNet ID paylaşımı</Text>
        <Text style={styles.infoItem}>• Güvenlik sertifikaları</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2c2c2c',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#666666',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
    width: width,
    height: height * 0.6,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#C62828',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  scanText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 80,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  controls: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#C62828',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanAgainButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
});
