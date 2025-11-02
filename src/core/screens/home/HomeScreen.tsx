/**
 * HOME SCREEN - Unicorn Premium Design
 * Midnight Professional theme
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, StatusBar, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import HomeHeader from './components/HomeHeader';
import StatusCard from './components/StatusCard';
import MeshNetworkPanel from './components/MeshNetworkPanel';
import EarthquakeMonitorCard from './components/EarthquakeMonitorCard';
import EmergencyButton from './components/EmergencyButton';
import FeatureGrid from './components/FeatureGrid';
import SOSModal from '../../components/SOSModal';
import * as haptics from '../../utils/haptics';
import { colors, spacing } from '../../theme';
import { voiceCommandService } from '../../services/VoiceCommandService';

export default function HomeScreen({ navigation }: any) {
  const { earthquakes, loading, refresh } = useEarthquakes();
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Initial load
    refresh();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
    
    return () => {
      // Cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.impactLight();
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleViewAllEarthquakes = useCallback(() => {
    haptics.impactLight();
    navigation?.navigate?.('AllEarthquakes');
  }, [navigation]);

  const handleSOSPress = useCallback(() => {
    haptics.impactHeavy();
    setShowSOSModal(true);
  }, []);

  const handleSOSConfirm = useCallback(() => {
    // SOS sent
  }, []);

  const handleSOSClose = useCallback(() => {
    setShowSOSModal(false);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={colors.background.primary}
        translucent={false}
      />
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
        >
          <HomeHeader />
          <StatusCard />
          <MeshNetworkPanel />
          <EarthquakeMonitorCard onViewAll={handleViewAllEarthquakes} navigation={navigation} />
          <EmergencyButton onPress={handleSOSPress} />
          <FeatureGrid navigation={navigation} />
        </ScrollView>
      </Animated.View>

      {/* Voice Command Floating Button */}
      <TouchableOpacity
        style={styles.voiceButton}
        onPress={async () => {
          haptics.impactMedium();
          console.log('🎤 Sesli komut butonu tıklandı, mevcut durum:', isListening);
          if (isListening) {
            await voiceCommandService.stopListening();
            setIsListening(false);
            console.log('🎤 Sesli komut durduruldu');
          } else {
            await voiceCommandService.startListening();
            setIsListening(true);
            console.log('🎤 Sesli komut başlatıldı');
          }
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isListening ? ['#10b981', '#059669'] : ['#6366f1', '#4f46e5']}
          style={styles.voiceButtonGradient}
        >
          <Ionicons 
            name={isListening ? 'mic' : 'mic-outline'} 
            size={28} 
            color="#ffffff" 
          />
        </LinearGradient>
      </TouchableOpacity>

      <SOSModal
        visible={showSOSModal}
        onClose={handleSOSClose}
        onConfirm={handleSOSConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  voiceButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
