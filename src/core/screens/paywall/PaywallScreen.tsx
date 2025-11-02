/**
 * PAYWALL SCREEN - Premium Subscription
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  { icon: 'map', title: 'Harita', description: 'Deprem ve aile üyesi konumları' },
  { icon: 'people', title: 'Aile Takibi', description: 'Aile üyelerinizin durumunu görün' },
  { icon: 'chatbubbles', title: 'Offline Mesajlaşma', description: 'BLE mesh ile mesajlaşma' },
  { icon: 'location', title: 'Konum Paylaşımı', description: 'Konumunuzu otomatik paylaşın' },
  { icon: 'shield-checkmark', title: 'Gelişmiş Güvenlik', description: 'E2E şifreli iletişim' },
  { icon: 'notifications', title: 'Öncelikli Bildirimler', description: 'Acil durum bildirimleri' },
];


export default function PaywallScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack?.()}>
          <Ionicons name="close" size={28} color="#f1f5f9" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.titleSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="star" size={48} color="#fbbf24" />
          </View>
          <Text style={styles.title}>AfetNet Premium</Text>
          <Text style={styles.subtitle}>
            Tüm özelliklere erişin ve acil durumlarda daha güvende olun
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={24} color="#3b82f6" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <Pressable style={styles.pricingCard}>
            <View style={styles.pricingHeader}>
              <Text style={styles.pricingTitle}>Aylık</Text>
              <View style={styles.pricingBadge}>
                <Text style={styles.pricingBadgeText}>En Popüler</Text>
              </View>
            </View>
            <Text style={styles.pricingPrice}>₺49,99</Text>
            <Text style={styles.pricingPeriod}>/ ay</Text>
          </Pressable>

          <Pressable style={styles.pricingCard}>
            <View style={styles.pricingHeader}>
              <Text style={styles.pricingTitle}>Yıllık</Text>
              <View style={[styles.pricingBadge, styles.saveBadge]}>
                <Text style={styles.pricingBadgeText}>%40 İndirim</Text>
              </View>
            </View>
            <Text style={styles.pricingPrice}>₺299,99</Text>
            <Text style={styles.pricingPeriod}>/ yıl</Text>
          </Pressable>
        </View>

        {/* CTA */}
        <Pressable style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Premium'a Başla</Text>
        </Pressable>

        {/* Footer */}
        <Text style={styles.footer}>
          7 gün ücretsiz deneme. İstediğiniz zaman iptal edebilirsiniz.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'flex-end',
  },
  content: {
    padding: 24,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    color: '#94a3b8',
    fontSize: 13,
  },
  pricingSection: {
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
  },
  pricingBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  saveBadge: {
    backgroundColor: '#10b981',
  },
  pricingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pricingPrice: {
    color: '#f1f5f9',
    fontSize: 36,
    fontWeight: 'bold',
  },
  pricingPeriod: {
    color: '#94a3b8',
    fontSize: 16,
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});

