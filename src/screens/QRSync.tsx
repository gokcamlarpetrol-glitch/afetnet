import React, { useMemo, useState } from "react";
import { logger } from '../utils/productionLogger';
import { Alert, View, Text, StyleSheet } from "react-native";
import { useFamily } from "../store/family";
import { useQueue } from "../store/queue";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { palette, spacing } from "../ui/theme";

// Safe QRCode import with fallback for Expo Go
let QRCode: any = null;
let isExpoGo = false;

// Detect Expo Go environment FIRST
try {
  const Constants = require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
} catch (e) {
  // Ignore
}

// Only try to import QRCode if NOT in Expo Go
if (!isExpoGo) {
  try {
    QRCode = require('react-native-qrcode-svg').default;
  } catch (e) {
    logger.warn('react-native-qrcode-svg not available, using fallback');
    isExpoGo = true;
  }
} else {
  logger.warn('Expo Go detected - skipping QRCode import');
}

// Safe barcode scanner import with fallback for Expo Go
let BarCodeScanner: any = null;

// Only try to import barcode scanner if NOT in Expo Go
if (!isExpoGo) {
  try {
    const barcodeScanner = require('expo-barcode-scanner');
    BarCodeScanner = barcodeScanner.BarCodeScanner;
  } catch (e) {
    logger.warn('expo-barcode-scanner not available, using fallback');
    isExpoGo = true;
  }
} else {
  logger.warn('Expo Go detected - skipping barcode scanner import');
}

export default function QRSyncScreen() {
  const fam = useFamily();
  const q = useQueue();
  const payload = useMemo(() => JSON.stringify({ fam: fam.list, queue: q.items.slice(0, 10) }), [fam.list, q.items]);
  const [scan, setScan] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: spacing(2), gap: spacing(2) }}>
      <Card title="Paylaş (QR)">
        <Text style={s.dim}>Aile üyeleri + ilk 10 kuyruk ögesi</Text>
        <View style={{ alignItems: "center", padding: spacing(2) }}>
          {QRCode && !isExpoGo ? (
            <QRCode value={payload} size={220} />
          ) : (
            <View style={{ width: 220, height: 220, backgroundColor: palette.background.dark, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
              <Text style={{ color: palette.textDim, textAlign: 'center', fontSize: 12 }}>
                QR Code not available in Expo Go{'\n'}
                Use development build for full functionality
              </Text>
            </View>
          )}
        </View>
      </Card>
      <Card title="Al (Tara)">
        {scan ? (
          BarCodeScanner && !isExpoGo ? (
            <BarCodeScanner
              style={{ height: 260 }}
              onBarCodeScanned={({ data }) => {
                try {
                  const obj = JSON.parse(String(data));
                  if (Array.isArray(obj?.fam)) {
                    obj.fam.forEach((m: any) => fam.add({ 
                      name: m.name ?? "Kişi", 
                      emoji: m.emoji ?? "🧑", 
                      status: "unknown",
                      isVerified: false,
                      addedAt: Date.now(),
                      connectionMethod: 'qr'
                    }));
                  }
                  // kuyrukları etik olarak doğrudan birleştirmiyoruz; sadece göster/gerekiyorsa kullanıcı ekler → basit tut
                  setScan(false);
                  Alert.alert("Başarılı", "Veri alındı");
                } catch {
                  Alert.alert("Hata", "Geçersiz QR");
                  setScan(false);
                }
              }}
            />
          ) : (
            <View style={{ height: 260, backgroundColor: palette.background.dark, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
              <Text style={{ color: palette.textDim, textAlign: 'center' }}>
                QR Scanner not available in Expo Go{'\n'}
                Use development build for full functionality
              </Text>
            </View>
          )
        ) : (
          <Button label="Taramayı Başlat" onPress={() => setScan(true)} />
        )}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({ dim: { color: palette.textDim } });
