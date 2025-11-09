/**
 * CORE APP - Clean Entry Point
 * Simple, no infinite loops, no complex initialization
 */

import React, { useEffect } from 'react';
import { AppState, AppStateStatus, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
import { premiumService } from './services/PremiumService';
import { usePremiumStore } from './stores/premiumStore';
import ErrorBoundary from './components/ErrorBoundary';
import PermissionGuard from './components/PermissionGuard';
import OfflineIndicator from './components/OfflineIndicator';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import PremiumCountdownModal from './components/PremiumCountdownModal';

// Screens
import HomeScreen from './screens/home';
import MapScreen from './screens/map';
import FamilyScreen from './screens/family';
import MessagesScreen from './screens/messages';
import SettingsScreen from './screens/settings';
import PaywallScreen from './screens/paywall';
import { AllEarthquakesScreen, EarthquakeDetailScreen } from './screens/earthquakes';
import DisasterMapScreen from './screens/map/DisasterMapScreen';
import PreparednessQuizScreen from './screens/onboarding/PreparednessQuizScreen';
import DisasterPreparednessScreen from './screens/preparedness/DisasterPreparednessScreen';
import AssemblyPointsScreen from './screens/assembly/AssemblyPointsScreen';
import FlashlightWhistleScreen from './screens/tools/FlashlightWhistleScreen';
import MedicalInformationScreen from './screens/medical/MedicalInformationScreen';
import DrillModeScreen from './screens/drill/DrillModeScreen';
import PsychologicalSupportScreen from './screens/support/PsychologicalSupportScreen';
import UserReportsScreen from './screens/reports/UserReportsScreen';
import VolunteerModuleScreen from './screens/volunteer/VolunteerModuleScreen';
import RescueTeamScreen from './screens/rescue/RescueTeamScreen';
import AddFamilyMemberScreen from './screens/family/AddFamilyMemberScreen';
import HealthProfileScreen from './screens/health/HealthProfileScreen';
import NewMessageScreen from './screens/messages/NewMessageScreen';
import ConversationScreen from './screens/messages/ConversationScreen';
import FamilyGroupChatScreen from './screens/family/FamilyGroupChatScreen';
import AdvancedSettingsScreen from './screens/settings/AdvancedSettingsScreen';
import OfflineMapSettingsScreen from './screens/settings/OfflineMapSettingsScreen';
import EarthquakeSettingsScreen from './screens/settings/EarthquakeSettingsScreen';
import SubscriptionManagementScreen from './screens/settings/SubscriptionManagementScreen';

// AI Screens
import RiskScoreScreen from './screens/ai/RiskScoreScreen';
import PreparednessPlanScreen from './screens/ai/PreparednessPlanScreen';
import PanicAssistantScreen from './screens/ai/PanicAssistantScreen';

// News Screens
import NewsDetailScreen from './screens/news/NewsDetailScreen';

// Navigation
import MainTabs from './navigation/MainTabs';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { colors } from './theme';
import { hasCompletedOnboarding } from './utils/onboardingStorage';

const Stack = createStackNavigator();

export default function CoreApp() {
  const [showOnboarding, setShowOnboarding] = React.useState<boolean | null>(null);

  // Check onboarding status on mount and when app comes to foreground
  const checkOnboardingStatus = React.useCallback(async () => {
    try {
      const completed = await hasCompletedOnboarding();
      setShowOnboarding(!completed);
    } catch (error) {
      // On error, show onboarding (fail-safe)
      setShowOnboarding(true);
    }
  }, []);

  React.useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  // ELITE: Listen for app state changes to check onboarding status
  // This ensures that when onboarding is completed, the app switches to main tabs
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - check onboarding status
        void checkOnboardingStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [checkOnboardingStatus]);

  // ELITE: Poll onboarding status periodically when onboarding is shown
  // This ensures immediate switch to main app when onboarding is completed
  React.useEffect(() => {
    if (showOnboarding === true) {
      const intervalId = setInterval(() => {
        void checkOnboardingStatus();
      }, 500); // Check every 500ms when onboarding is active

      return () => {
        clearInterval(intervalId);
      };
    }
    return undefined;
  }, [showOnboarding, checkOnboardingStatus]);
  useEffect(() => {
    // ELITE: Track app startup time (safe initialization)
    if (typeof global !== 'undefined') {
      (global as any).__AFETNET_START_TIME__ = Date.now();
    }
    
    // CRITICAL: Initialize app with proper error handling
    // MUST await to catch initialization errors
    void initializeApp().catch(async (error) => {
      // CRITICAL: Log initialization failure but don't crash app
      // Use production logger (already imported at top)
      const { createLogger } = require('./utils/logger');
      const logger = createLogger('App');
      logger.error('❌ CRITICAL: App initialization failed:', error);
      
      // Report to crashlytics (use dynamic import to prevent circular dependencies)
      try {
        const { firebaseCrashlyticsService } = await import('./services/FirebaseCrashlyticsService');
        firebaseCrashlyticsService.recordError(
          error instanceof Error ? error : new Error(String(error)),
          { source: 'app_initialization' }
        );
      } catch {
        // Silently fail if crashlytics not available
      }
      
      // Try to continue anyway - some services may still work
    });

    // CRITICAL: Check premium status when app comes to foreground
    // This ensures premium status is always up-to-date
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - check premium status
        void premiumService.checkPremiumStatus().catch((error) => {
          // Silently fail - premium check is not critical for app functionality
          const { createLogger } = require('./utils/logger');
          const logger = createLogger('App');
          logger.warn('Premium status check failed:', error);
        });
        
        // Also check expiration
        usePremiumStore.getState().checkExpiration();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      subscription.remove();
      shutdownApp();
    };
  }, []);

  // ELITE: Premium countdown modal state
  const [countdownVisible, setCountdownVisible] = React.useState(false);
  const [countdownData, setCountdownData] = React.useState<any>(null);
  const countdownModalRef = React.useRef<any>(null);
  
  // ELITE: Initialize premium alert manager
  React.useEffect(() => {
    const { premiumAlertManager } = require('./services/PremiumAlertManager');
    
    // Set modal ref and callback
    premiumAlertManager.setModalRef(countdownModalRef);
    premiumAlertManager.setOnShowCallback((data: any) => {
      setCountdownData(data);
      setCountdownVisible(true);
    });
    premiumAlertManager.setOnDismissCallback(() => {
      setCountdownVisible(false);
      setCountdownData(null);
    });
  }, []);

  return (
    <ErrorBoundary>
      <PermissionGuard>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <OfflineIndicator />
            <SyncStatusIndicator />
            
            {/* ELITE: Premium Countdown Modal */}
            <PremiumCountdownModal
              ref={countdownModalRef}
              visible={countdownVisible}
              data={countdownData}
              onDismiss={() => {
                setCountdownVisible(false);
                setCountdownData(null);
              }}
            />
            
            <NavigationContainer>
              {showOnboarding === null ? (
                // Loading state - show nothing or a simple loading indicator
                <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: colors.text.secondary }}>Yükleniyor...</Text>
                </View>
              ) : showOnboarding ? (
                // Show onboarding flow
                <OnboardingNavigator />
              ) : (
                // Show main app
                <Stack.Navigator
                  initialRouteName="MainTabs"
                  screenOptions={{
                    headerBackTitleVisible: false,
                    headerBackTitle: ' ',
                  }}
                >
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen 
                name="Paywall" 
                component={PaywallScreen}
                options={{ 
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="AllEarthquakes" 
                component={AllEarthquakesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="EarthquakeDetail" 
                component={EarthquakeDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="DisasterMap" 
                component={DisasterMapScreen}
              />
              <Stack.Screen 
                name="PreparednessQuiz" 
                component={PreparednessQuizScreen}
              />
              <Stack.Screen 
                name="DisasterPreparedness" 
                component={DisasterPreparednessScreen}
              />
              <Stack.Screen 
                name="AssemblyPoints" 
                component={AssemblyPointsScreen}
              />
              <Stack.Screen 
                name="FlashlightWhistle" 
                component={FlashlightWhistleScreen}
              />
              <Stack.Screen 
                name="MedicalInformation" 
                component={MedicalInformationScreen}
              />
              <Stack.Screen 
                name="DrillMode" 
                component={DrillModeScreen}
              />
              <Stack.Screen 
                name="PsychologicalSupport" 
                component={PsychologicalSupportScreen}
              />
              <Stack.Screen 
                name="UserReports" 
                component={UserReportsScreen}
              />
              <Stack.Screen 
                name="VolunteerModule" 
                component={VolunteerModuleScreen}
              />
              <Stack.Screen 
                name="RescueTeam" 
                component={RescueTeamScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="AddFamilyMember" 
                component={AddFamilyMemberScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen 
                name="HealthProfile" 
                component={HealthProfileScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="NewMessage" 
                component={NewMessageScreen}
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen 
                name="Conversation" 
                component={ConversationScreen}
              />
              <Stack.Screen 
                name="RiskScore" 
                component={RiskScoreScreen}
                options={{ 
                  headerShown: true,
                  headerTitle: 'Risk Skoru',
                  headerStyle: { backgroundColor: colors.background.primary },
                  headerTintColor: colors.text.primary,
                }}
              />
              <Stack.Screen 
                name="PreparednessPlan" 
                component={PreparednessPlanScreen}
                options={{ 
                  headerShown: true,
                  headerTitle: 'Hazırlık Planı',
                  headerStyle: { backgroundColor: colors.background.primary },
                  headerTintColor: colors.text.primary,
                }}
              />
              <Stack.Screen 
                name="PanicAssistant" 
                component={PanicAssistantScreen}
                options={{ 
                  headerShown: true,
                  headerTitle: 'Afet Rehberi',
                  headerStyle: { backgroundColor: colors.background.primary },
                  headerTintColor: colors.text.primary,
                }}
              />
              <Stack.Screen 
                name="NewsDetail" 
                component={NewsDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="FamilyGroupChat" 
                component={FamilyGroupChatScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="AdvancedSettings" 
                component={AdvancedSettingsScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="OfflineMapSettings" 
                component={OfflineMapSettingsScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="EarthquakeSettings" 
                component={EarthquakeSettingsScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="SubscriptionManagement" 
                component={SubscriptionManagementScreen}
                options={{ 
                  headerShown: false,
                }}
              />
              </Stack.Navigator>
              )}
            </NavigationContainer>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PermissionGuard>
    </ErrorBoundary>
  );
}

