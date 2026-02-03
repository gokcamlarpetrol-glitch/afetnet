/**
 * EULA MODAL - App Store Compliance
 * Mandatory End User License Agreement (Guideline 1.2)
 * Users must agree to this before using the app.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../../utils/haptics';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';

const { height } = Dimensions.get('window');

export const EULAModal = () => {
  const eulaAccepted = useSettingsStore((state) => state.eulaAccepted);
  const setEulaAccepted = useSettingsStore((state) => state.setEulaAccepted);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // If already accepted, return null (don't render anything)
  if (eulaAccepted) return null;

  const handleAgree = () => {
    haptics.notificationSuccess();
    setEulaAccepted(true);
  };

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (!scrolledToBottom) {
        setScrolledToBottom(true);
        haptics.impactLight();
      }
    }
  };

  return (
    <Modal
      visible={!eulaAccepted}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Blurred Background */}
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={32} color={colors.brand.primary} />
            </View>
            <Text style={styles.title}>Kullanım Sözleşmesi</Text>
            <Text style={styles.subtitle}>
              AfetNet'i kullanmaya başlamadan önce lütfen aşağıdaki kuralları okuyup onaylayın.
            </Text>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            indicatorStyle="black"
          >
            <Text style={styles.sectionTitle}>1. Kullanıcı İçeriği (UGC)</Text>
            <Text style={styles.text}>
              AfetNet, kullanıcıların mesajlaşmasına ve harita üzerinde işaretleme yapmasına olanak tanır.
              Aşağıdaki davranışlara <Text style={styles.bold}>KESİNLİKLE TOLERANS GÖSTERİLMEZ</Text>:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hakaret, küfür, nefret söylemi veya taciz edici içerikler.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yasa dışı aktiviteleri teşvik eden veya pornografik materyaller.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yanlış ihbarlar veya panik yaratmayı amaçlayan dezenformasyon.</Text>
            </View>

            <Text style={styles.sectionTitle}>2. Yaptırımlar</Text>
            <Text style={styles.text}>
              Bu kuralları ihlal eden kullanıcılar:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Sistemden kalıcı olarak yasaklanacaktır (Ban).</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>İlgili içerikler derhal kaldırılacaktır.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Gerektiğinde yasal mercilere bildirilecektir.</Text>
            </View>

            <Text style={styles.sectionTitle}>3. Raporlama</Text>
            <Text style={styles.text}>
              Rahatsız edici bir içerik veya kullanıcı gördüğünüzde, lütfen "Şikayet Et" butonunu kullanarak bize bildirin.
              Şikayetler 24 saat içinde incelenip gereği yapılacaktır.
            </Text>

            <Text style={styles.sectionTitle}>4. Sorumluluk Reddi</Text>
            <Text style={styles.text}>
              AfetNet, kullanıcıların oluşturduğu içeriklerden sorumlu tutulamaz. Ancak, bu içerikleri denetleme ve kaldırma hakkını saklı tutar.
            </Text>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerInfo}>
              Devam ederek, yukarıdaki Hizmet Koşullarını ve Gizlilik Politikasını kabul etmiş sayılırsınız.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.9 },
                !scrolledToBottom && styles.buttonDisabled,
              ]}
              onPress={handleAgree}
              disabled={!scrolledToBottom}
            >
              <LinearGradient
                colors={scrolledToBottom
                  ? [colors.brand.primary, '#b91c1c']
                  : ['#9ca3af', '#6b7280']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {scrolledToBottom ? 'Okudum ve Kabul Ediyorum' : 'Lütfen Sona Kadar Okuyun'}
                </Text>
                {scrolledToBottom && <Ionicons name="arrow-forward" size={20} color="#fff" />}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    height: '90%', // Fixed height to ensure flex works
    maxHeight: height * 0.9,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex', // Explicit flex context
    flexDirection: 'column',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#dc2626',
  },
  bulletPoint: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#475569',
    marginRight: 8,
    fontWeight: 'bold',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  footerInfo: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
