/**
 * ADVANCED FEATURES SCREEN
 * Hub for premium advanced features
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import Card from '../../components/Card';
import * as haptics from '../../utils/haptics';

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  color: string;
}

function FeatureCard({ icon, title, description, onPress, color }: FeatureCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.featureCard,
      pressed && styles.pressed,
    ]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
    </Pressable>
  );
}

export default function AdvancedFeaturesScreen({ navigation }: any) {
  const features = [
    {
      icon: 'medical' as const,
      title: 'Triage Sistemi',
      description: 'Hızlı yaralı sınıflandırma',
      color: colors.status.danger,
      screen: 'Triage',
    },
    {
      icon: 'warning' as const,
      title: 'Tehlike Bölgeleri',
      description: 'Risk alanlarını işaretle',
      color: colors.status.warning,
      screen: 'Hazard',
    },
    {
      icon: 'cube' as const,
      title: 'Lojistik Yönetimi',
      description: 'Malzeme talep/teklif',
      color: colors.status.info,
      screen: 'Logistics',
    },
    {
      icon: 'search' as const,
      title: 'SAR Modu',
      description: 'Arama kurtarma operasyonları',
      color: colors.status.success,
      screen: 'SAR',
    },
    {
      icon: 'home' as const,
      title: 'Enkaz Modu',
      description: 'Enkaz altı iletişim',
      color: colors.earthquake.strong,
      screen: 'Rubble',
    },
    {
      icon: 'people' as const,
      title: 'Yakın Sohbet',
      description: 'Offline mesajlaşma',
      color: colors.status.online,
      screen: 'NearbyChat',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gelişmiş Özellikler</Text>
        <Text style={styles.headerSubtitle}>
          Profesyonel afet müdahale araçları
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            color={feature.color}
            onPress={() => {
              // ELITE: Navigate to actual feature screens
              haptics.impactMedium();
              
              // Map features to actual screens
              const screenMap: { [key: string]: string } = {
                'Triage': 'MedicalInformation', // Medical triage
                'Hazard': 'DisasterMap', // Hazard zones on map
                'Logistics': 'VolunteerModule', // Volunteer/logistics
                'SAR': 'RescueTeam', // Search and rescue
                'Rubble': 'EnkazDetection', // Rubble mode - use EnkazDetectionService
                'NearbyChat': 'Messages', // Nearby chat via BLE Mesh
              };
              
              const targetScreen = screenMap[feature.screen];
              
              if (targetScreen) {
                try {
                  const parentNavigator = navigation?.getParent?.() || navigation;
                  if (parentNavigator && typeof parentNavigator.navigate === 'function') {
                    parentNavigator.navigate(targetScreen);
                  } else {
                    navigation?.navigate?.(targetScreen);
                  }
                } catch (error) {
                  console.error(`Navigation error for ${feature.screen}:`, error);
                  // Fallback: Show info about the feature
                  Alert.alert(
                    feature.title,
                    feature.description + '\n\nBu özellik ilgili ekranda mevcuttur.',
                    [{ text: 'Tamam' }]
                  );
                }
              } else {
                // For EnkazDetection, show info
                if (feature.screen === 'Rubble') {
                  Alert.alert(
                    'Enkaz Modu',
                    'Enkaz modu otomatik olarak aktif. Telefonunuzu enkaz altında bırakırsanız, otomatik olarak SOS sinyali gönderir ve konumunuzu paylaşır.',
                    [{ text: 'Tamam' }]
                  );
                } else {
                  // Default: Navigate to related screen
                  navigation?.navigate?.('Map');
                }
              }
            }}
          />
        ))}

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={colors.status.info} />
            <Text style={styles.infoTitle}>Premium Özellikler</Text>
          </View>
          <Text style={styles.infoText}>
            Bu özellikler profesyonel afet müdahale ekipleri için tasarlanmıştır. 
            Offline çalışır ve BLE mesh ağı üzerinden senkronize olur.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: 4,
  },
  featureDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  infoCard: {
    marginTop: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginLeft: 8,
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
});

