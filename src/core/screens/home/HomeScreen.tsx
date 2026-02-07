/**
 * HOME SCREEN - ELITE V2 (Modern Calm Trust)
 * "Living Interface" with Bespoke Design System
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, Animated, Pressable } from 'react-native';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import HomeHeader from './components/HomeHeader';
import EmergencyButton from './components/EmergencyButton';
import FeatureGrid from './components/FeatureGrid';
import AIAssistantCard from './components/AIAssistantCard';
import NewsCard from './components/NewsCard';
import { PaperBackground } from '../../components/design-system/PaperBackground';
import { PremiumEarthquakeCard } from '../../components/design-system/ModernEarthquakeCard';
// ELITE: Family Check-In moved to Family Screen

import SOSModal from '../../components/SOSModal';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
// ELITE: Family store no longer needed on home screen
import { createLogger } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

const logger = createLogger('HomeScreen');

// ELITE: Properly typed navigation prop
type HomeScreenNavigationProp = StackNavigationProp<ParamListBase>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { earthquakes, loading, error, lastUpdate, refresh } = useEarthquakes();
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const newsEnabled = useSettingsStore((state) => state.newsEnabled);

  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    refresh().catch((err) => logger.error('Refresh failed', err));

    // Elite Entrance Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.impactLight();
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleSOSPress = useCallback(() => {
    haptics.impactHeavy();
    setShowSOSModal(true);
  }, []);

  const latestEarthquake = earthquakes[0];
  const isDataStale = !!lastUpdate && Date.now() - lastUpdate > 10 * 60 * 1000;

  const dataStatusText = error
    ? 'Deprem verisi güncellenemedi. Son alınan veri gösteriliyor.'
    : isDataStale
      ? 'Deprem verisi gecikmeli olabilir. Yenileyerek güncelleyin.'
      : null;





  return (
    <PaperBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            tintColor="#1F4E79"
            colors={['#1F4E79']}
          />
        }
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* 1. Header - Identity & Status */}
        <HomeHeader />

        {/* 2. Modern Earthquake Card with Map Preview */}
        {dataStatusText && (
          <View style={styles.dataStatusBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#92400e" />
            <Text style={styles.dataStatusText}>{dataStatusText}</Text>
            <Pressable onPress={onRefresh} style={styles.dataStatusAction}>
              <Text style={styles.dataStatusActionText}>Yenile</Text>
            </Pressable>
          </View>
        )}

        {latestEarthquake && (
          <PremiumEarthquakeCard
            magnitude={latestEarthquake.magnitude}
            location={latestEarthquake.location}
            time={new Date(latestEarthquake.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            depth={latestEarthquake.depth}
            latitude={latestEarthquake.latitude}
            longitude={latestEarthquake.longitude}
            onPress={() => navigation.navigate('AllEarthquakes')}
            onMapPress={() => navigation.navigate('DisasterMap', { earthquake: latestEarthquake })}
          />
        )}

        {/* 3. Family Check-In moved to Family Screen */}

        {/* 4. Editorial News Carousel */}
        {newsEnabled && <NewsCard />}

        {/* 5. AI Guardian - Premium Feature */}
        <AIAssistantCard navigation={navigation} />

        {/* 6. REMOVED: Preparedness Checklist (Redundant with AI Assistant) */}

        {/* 7. Emergency Action - The "Red Button" */}
        <EmergencyButton onPress={handleSOSPress} />

        {/* 8. Tools & Features Grid */}
        <FeatureGrid navigation={navigation} />

        {/* 9. Footer removed - info in onboarding */}

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>

      <SOSModal
        visible={showSOSModal}
        onClose={() => setShowSOSModal(false)}
        onConfirm={() => setShowSOSModal(false)}
      />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16, // Consistent premium spacing
  },
  bottomSpacer: {
    height: 80,
  },
  dataStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dataStatusText: {
    flex: 1,
    color: '#78350f',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  dataStatusAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
  },
  dataStatusActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
