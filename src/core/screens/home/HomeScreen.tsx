/**
 * HOME SCREEN - ELITE V2 (Modern Calm Trust)
 * "Living Interface" with Bespoke Design System
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, StatusBar, Animated } from 'react-native';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import HomeHeader from './components/HomeHeader';
import EmergencyButton from './components/EmergencyButton';
import FeatureGrid from './components/FeatureGrid';
import AIAssistantCard from './components/AIAssistantCard';
import NewsCard from './components/NewsCard';
import AboutAfetNetCard from './components/AboutAfetNetCard';

import { PaperBackground } from '../../components/design-system/PaperBackground';
import { SeismicAlertBanner } from '../../components/design-system/SeismicAlertBanner';
import { FamilyCheckInModule } from '../../components/design-system/FamilyCheckInModule';

import SOSModal from '../../components/SOSModal';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFamilyStore } from '../../stores/familyStore';
import { createLogger } from '../../utils/logger';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

const logger = createLogger('HomeScreen');

// ELITE: Properly typed navigation prop
type HomeScreenNavigationProp = StackNavigationProp<ParamListBase>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { earthquakes, loading, error, refresh } = useEarthquakes();
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const newsEnabled = useSettingsStore((state) => state.newsEnabled);

  const familyMembers = useFamilyStore((state) => state.members);

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

  // Map Family Members to Component Props
  const mappedFamilyMembers = familyMembers.map(m => ({
    id: m.id,
    name: m.name,
    status: m.status as 'safe' | 'warning' | 'danger' | 'unknown',
    lastSeen: new Date(m.lastSeen || Date.now()).toLocaleTimeString(),
    isOnline: (Date.now() - (m.lastSeen || 0)) < 1000 * 60 * 5, // Online if seen in last 5 mins
  }));



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

        {/* 2. Signature: Seismic Alert Banner */}
        {latestEarthquake && (
          <SeismicAlertBanner
            magnitude={latestEarthquake.magnitude}
            location={latestEarthquake.location}
            time={new Date(latestEarthquake.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            depth={latestEarthquake.depth}
            onPress={() => navigation.navigate('AllEarthquakes')}
          />
        )}

        {/* 3. Signature: Family Check-In */}
        <FamilyCheckInModule members={mappedFamilyMembers} />

        {/* 4. Editorial News Carousel */}
        {newsEnabled && <NewsCard />}

        {/* 5. AI Guardian - Premium Feature */}
        <AIAssistantCard navigation={navigation} />

        {/* 6. REMOVED: Preparedness Checklist (Redundant with AI Assistant) */}

        {/* 7. Emergency Action - The "Red Button" */}
        <EmergencyButton onPress={handleSOSPress} />

        {/* 8. Tools & Features Grid */}
        <FeatureGrid navigation={navigation} />

        {/* 9. Footer */}
        <AboutAfetNetCard />

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
});
