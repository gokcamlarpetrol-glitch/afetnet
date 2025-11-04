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
import MeshNetworkPanel from './components/MeshNetworkPanel';
import EarthquakeMonitorCard from './components/EarthquakeMonitorCard';
import EmergencyButton from './components/EmergencyButton';
import FeatureGrid from './components/FeatureGrid';
import AIAssistantCard from './components/AIAssistantCard';
import NewsCard from './components/NewsCard';
import SOSModal from '../../components/SOSModal';
import * as haptics from '../../utils/haptics';
import { colors, spacing } from '../../theme';
import { getSOSService } from '../../services/SOSService';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { aiFeatureToggle } from '../../ai/services/AIFeatureToggle';

export default function HomeScreen({ navigation }: any) {
  const { earthquakes, loading, refresh } = useEarthquakes();
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [aiFeaturesEnabled, setAiFeaturesEnabled] = useState(true); // Default: true

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Initial load
    refresh();
    
    // AI feature flag kontrolü
    const checkAIFeatures = async () => {
      try {
        // Feature toggle'ın initialize olduğundan emin ol
        await aiFeatureToggle.initialize();
        setAiFeaturesEnabled(aiFeatureToggle.isFeatureEnabled());
      } catch (error) {
        console.error('AI feature check error:', error);
        // Hata durumunda da aktif göster
        setAiFeaturesEnabled(true);
      }
    };
    checkAIFeatures();
    
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

  const handleSOSConfirm = useCallback(async () => {
    try {
      haptics.impactHeavy();
      
      // Get current location
      let location: { latitude: number; longitude: number; accuracy: number } | null = null;
      try {
        // Ensure Location module is available
        if (!Location || typeof Location.requestForegroundPermissionsAsync !== 'function') {
          throw new Error('Location module not available');
        }
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 10,
          };
        }
      } catch (locError) {
        console.warn('Location error:', locError);
        // Continue without location - SOS will still work
      }

      // Send SOS signal
      const sosService = getSOSService();
      await sosService.sendSOSSignal(
        location,
        'Acil yardım gerekiyor! Konum paylaşıldı.'
      );

      // Close modal
      setShowSOSModal(false);

      // Show success message
      Alert.alert(
        '🆘 SOS Gönderildi',
        'Yardım çağrınız yakındaki kişilere ve yetkililere iletildi. Konumunuz otomatik paylaşılıyor.',
        [{ text: 'Tamam', style: 'default' }]
      );

      haptics.notificationSuccess();
    } catch (error) {
      console.error('SOS send error:', error);
      Alert.alert(
        'Hata',
        'SOS gönderilirken bir hata oluştu. Lütfen tekrar deneyin veya 112\'yi arayın.',
        [{ text: 'Tamam' }]
      );
      haptics.notificationError();
    }
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
          
          {/* AI Features - En üstte, feature flag ile kontrol edilir */}
          {aiFeaturesEnabled && (
            <>
              <NewsCard />
              <AIAssistantCard navigation={navigation} />
            </>
          )}
          
          <MeshNetworkPanel />
          <EarthquakeMonitorCard onViewAll={handleViewAllEarthquakes} navigation={navigation} />
          <EmergencyButton onPress={handleSOSPress} />
          <FeatureGrid navigation={navigation} />
        </ScrollView>
      </Animated.View>

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
  // Voice command button removed - Apple review compliance
});
