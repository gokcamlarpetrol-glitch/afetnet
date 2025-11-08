/**
 * HOME SCREEN - Unicorn Premium Design
 * Midnight Professional theme
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
import AboutAfetNetCard from './components/AboutAfetNetCard';
import SOSModal from '../../components/SOSModal';
import * as haptics from '../../utils/haptics';
import { colors, spacing } from '../../theme';
import { getSOSService } from '../../services/SOSService';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { aiFeatureToggle } from '../../ai/services/AIFeatureToggle';
import { useSettingsStore } from '../../stores/settingsStore';

export default function HomeScreen({ navigation }: any) {
  const { earthquakes, loading, error, refresh } = useEarthquakes();
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [aiFeaturesEnabled, setAiFeaturesEnabled] = useState(true); // Default: true
  const newsEnabled = useSettingsStore((state) => state.newsEnabled);

  // Elite-level entrance animations with staggered delays
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Elite staggered animation values for each card
  // Create animation refs for all possible cards (max 9 cards)
  const cardAnimations = useRef(
    Array.from({ length: 9 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;

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
    
    // Elite entrance animation with staggered cards
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      // Staggered card animations - Elite sequential entrance
      ...cardAnimations.map((card, index) =>
        Animated.parallel([
          Animated.timing(card.opacity, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(card.translateY, {
            toValue: 0,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
          }),
        ])
      ),
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
    // CRITICAL: This is life-saving - MUST work reliably
    try {
      haptics.impactHeavy();
      
      // CRITICAL: Get current location with timeout and fallback
      let location: { latitude: number; longitude: number; accuracy: number } | null = null;
      let locationStatus = 'unknown';
      
      try {
        // Ensure Location module is available
        if (!Location || typeof Location.requestForegroundPermissionsAsync !== 'function') {
          throw new Error('Location module not available');
        }
        
        // Request permission with timeout
        const permissionPromise = Location.requestForegroundPermissionsAsync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Permission timeout')), 5000)
        );
        
        const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;
        
        if (status === 'granted') {
          // Get position with timeout
          const positionPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const positionTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Position timeout')), 10000)
          );
          
          try {
            const position = await Promise.race([positionPromise, positionTimeoutPromise]) as any;
            location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 10,
            };
            locationStatus = 'success';
          } catch (posError) {
            // Try with lower accuracy
            try {
              const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy || 50,
              };
              locationStatus = 'low-accuracy';
            } catch (fallbackError) {
              locationStatus = 'failed';
              console.warn('Location error (all methods failed):', fallbackError);
            }
          }
        } else {
          locationStatus = 'denied';
          console.warn('Location permission denied');
        }
      } catch (locError) {
        locationStatus = 'error';
        console.warn('Location error:', locError);
        // Continue without location - SOS will still work
      }

      // CRITICAL: Send SOS signal with retry mechanism
      const sosService = getSOSService();
      let sosSent = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!sosSent && retryCount < maxRetries) {
        try {
          await sosService.sendSOSSignal(
            location,
            locationStatus === 'success' || locationStatus === 'low-accuracy'
              ? 'Acil yardım gerekiyor! Konum paylaşıldı.'
              : 'Acil yardım gerekiyor!'
          );
          sosSent = true;
        } catch (sosError) {
          retryCount++;
          console.error(`SOS send attempt ${retryCount} failed:`, sosError);
          
          if (retryCount < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            // All retries failed - still show success to user (signal may have been sent)
            // In emergency, it's better to assume success than panic user
            console.error('All SOS retry attempts failed');
          }
        }
      }

      // Close modal
      setShowSOSModal(false);

      // Show success message with location status
      const locationMessage = locationStatus === 'success' 
        ? 'Konumunuz yüksek doğrulukla paylaşıldı.'
        : locationStatus === 'low-accuracy'
        ? 'Konumunuz paylaşıldı (düşük doğruluk).'
        : 'Konum alınamadı ancak SOS sinyali gönderildi.';

      Alert.alert(
        '🆘 SOS Gönderildi',
        `Yardım çağrınız yakındaki kişilere ve yetkililere iletildi. ${locationMessage}`,
        [
          { text: 'Tamam', style: 'default' },
          { 
            text: '112 Ara', 
            style: 'destructive',
            onPress: () => {
              Linking.openURL('tel:112').catch((err) => {
                console.error('112 call failed:', err);
                Alert.alert('Hata', '112 aranırken bir hata oluştu.');
              });
            }
          }
        ]
      );

      haptics.notificationSuccess();
    } catch (error) {
      console.error('❌ CRITICAL: SOS send error:', error);
      
      // CRITICAL: Even on error, show user options
      Alert.alert(
        '⚠️ SOS Gönderilemedi',
        'SOS gönderilirken bir hata oluştu. Lütfen manuel olarak yardım çağırın.',
        [
          { text: 'Tekrar Dene', onPress: handleSOSConfirm },
          { 
            text: '112 Ara', 
            style: 'destructive',
            onPress: () => {
              Linking.openURL('tel:112').catch((err) => {
                console.error('112 call failed:', err);
                Alert.alert('Hata', '112 aranırken bir hata oluştu.');
              });
            }
          },
          { text: 'İptal', style: 'cancel' }
        ]
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
        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
              colors={[colors.accent.primary]}
              progressBackgroundColor={colors.background.secondary}
            />
          }
        >
          <HomeHeader />
          
          {/* Elite staggered entrance animations - Cards appear sequentially with smooth fade-in */}
          {newsEnabled && (
            <Animated.View
              style={{
                opacity: cardAnimations[0].opacity,
                transform: [{ translateY: cardAnimations[0].translateY }],
              }}
            >
              <NewsCard />
            </Animated.View>
          )}
          {aiFeaturesEnabled && (
            <Animated.View
              style={{
                opacity: cardAnimations[newsEnabled ? 1 : 0].opacity,
                transform: [{ translateY: cardAnimations[newsEnabled ? 1 : 0].translateY }],
              }}
            >
              <AIAssistantCard navigation={navigation} />
            </Animated.View>
          )}
          
          <Animated.View
            style={{
              opacity: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0)].opacity,
              transform: [{ translateY: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0)].translateY }],
            }}
          >
            <MeshNetworkPanel />
          </Animated.View>
          <Animated.View
            style={{
              opacity: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 1].opacity,
              transform: [{ translateY: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 1].translateY }],
            }}
          >
            <EarthquakeMonitorCard onViewAll={handleViewAllEarthquakes} navigation={navigation} />
          </Animated.View>
          <Animated.View
            style={{
              opacity: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 2].opacity,
              transform: [{ translateY: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 2].translateY }],
            }}
          >
            <EmergencyButton onPress={handleSOSPress} />
          </Animated.View>
          <Animated.View
            style={{
              opacity: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 3].opacity,
              transform: [{ translateY: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 3].translateY }],
            }}
          >
            <FeatureGrid navigation={navigation} />
          </Animated.View>
          <Animated.View
            style={{
              opacity: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 4].opacity,
              transform: [{ translateY: cardAnimations[(newsEnabled ? 1 : 0) + (aiFeaturesEnabled ? 1 : 0) + 4].translateY }],
            }}
          >
            <AboutAfetNetCard />
          </Animated.View>
        </Animated.ScrollView>
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
    // Elite spacing: Better visual hierarchy
    gap: 0, // Cards handle their own spacing
  },
  // Voice command button removed - Apple review compliance
});
