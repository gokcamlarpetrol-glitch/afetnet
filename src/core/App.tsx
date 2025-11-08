/**
 * CORE APP - Clean Entry Point
 * Simple, no infinite loops, no complex initialization
 */

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
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

// AI Screens
import RiskScoreScreen from './screens/ai/RiskScoreScreen';
import PreparednessPlanScreen from './screens/ai/PreparednessPlanScreen';
import PanicAssistantScreen from './screens/ai/PanicAssistantScreen';

// News Screens
import NewsDetailScreen from './screens/news/NewsDetailScreen';

// Navigation
import MainTabs from './navigation/MainTabs';
import { colors } from './theme';

const Stack = createStackNavigator();

export default function CoreApp() {
  useEffect(() => {
    // ELITE: Track app startup time (safe initialization)
    if (typeof global !== 'undefined') {
      (global as any).__AFETNET_START_TIME__ = Date.now();
    }
    
    // CRITICAL: Initialize app with proper error handling
    // MUST await to catch initialization errors
    void initializeApp().catch(async (error) => {
      // CRITICAL: Log initialization failure but don't crash app
      if (__DEV__) {
        console.error('❌ CRITICAL: App initialization failed:', error);
      }
      // Use production logger for production builds
      const { createLogger } = require('./utils/logger');
      const logger = createLogger('App');
      logger.error('CRITICAL: App initialization failed:', error);
      
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

    // Cleanup on unmount
    return () => {
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
                options={{ presentation: 'modal' }}
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
              </Stack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PermissionGuard>
    </ErrorBoundary>
  );
}

