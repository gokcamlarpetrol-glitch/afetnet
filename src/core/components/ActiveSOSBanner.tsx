/**
 * ACTIVE SOS BANNER — global, her ekranda görünen kalıcı SOS durdurma kontrolü.
 *
 * KRİTİK (görev #9): SOSModal yalnızca HomeScreen'de, HomeScreen'in local
 * `showSOSModal` state'iyle render ediliyordu. SOS aktifken kullanıcı başka
 * bir ekrana geçer / uygulamayı arka plana alıp döner / Android geri jesti
 * yaparsa modal unmount oluyor ve SOS'u durduracak HİÇBİR arayüz kalmıyordu —
 * SOS yayını + alarm + titreşim, 30 dk'lık otomatik temizliğe kadar
 * durdurulamadan sürüyordu (aile/yakındakiler bu süre boyunca sahte acil görür).
 *
 * Bu banner App.tsx'te global overlay olarak mount edilir ve `isActive` olduğu
 * sürece HER ekranda bir "DURDUR" kontrolü garanti eder. SOSModal'ın tetikleme
 * mantığına dokunmaz — yalnızca durdurma yolunu her zaman erişilebilir kılar.
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSOSStore, unifiedSOSController } from '../services/sos';
import { emergencyHealthSharingService } from '../services/EmergencyHealthSharingService';
import * as haptics from '../utils/haptics';

export default function ActiveSOSBanner() {
  const isActive = useSOSStore(state => state.isActive);
  const insets = useSafeAreaInsets();

  const handleStop = useCallback(() => {
    haptics.impactMedium();
    // cancelSOS() store'da isActive'i senkron olarak false yapar → bu banner
    // bir sonraki render'da kendini gizler. Yayın iptali (mesh/Firestore)
    // arka planda sürer. SOSModal.handleStop ile aynı davranış.
    void unifiedSOSController.cancelSOS();
    emergencyHealthSharingService.stopBroadcast().catch(() => { /* best-effort */ });
  }, []);

  if (!isActive) return null;

  return (
    <View
      style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <Ionicons name="radio" size={20} color="#fff" />
        <Text style={styles.text} numberOfLines={1}>
          SOS aktif — yayında
        </Text>
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel="SOS'u durdur"
          accessibilityHint="Aktif acil yardım çağrısını sonlandırır."
        >
          <Text style={styles.stopText}>DURDUR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  stopButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  stopText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '900',
  },
});
