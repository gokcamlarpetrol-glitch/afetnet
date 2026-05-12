import React, { Suspense, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import MainTabs from './MainTabs';

// Eager Load — Critical Path (initial screen, high frequency, life safety)
import { AllEarthquakesScreen, EarthquakeDetailScreen } from '../screens/earthquakes';
import ConversationScreen from '../screens/messages/ConversationScreen';
import SOSHelpScreen from '../screens/sos/SOSHelpScreen';

// ELITE: Per-screen Suspense wrapper — prevents tab bar disappearing during lazy load
// Also catches import errors gracefully (network failure, bundle corruption)
function withLazy(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  const LazyComponent = React.lazy(importFn);
  return function LazyScreen(props: any) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LazyScreenErrorBoundary>
          <LazyComponent {...props} />
        </LazyScreenErrorBoundary>
      </Suspense>
    );
  };
}

// Error boundary for lazy-loaded screens — prevents whole app crash on import failure
class LazyScreenErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    if (__DEV__) console.error('Lazy screen load failed:', error);
  }
  handleRetry = () => {
    this.setState({ hasError: false });
  };
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ekran yüklenemedi.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Tekrar dene"
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Lazy Load — All other screens (per-screen Suspense, safe for React Navigation)
const NewMessageScreen = withLazy(() => import('../screens/messages/NewMessageScreen'));
const SOSConversationScreen = withLazy(() => import('../screens/messages/SOSConversationScreen'));
const CreateGroupScreen = withLazy(() => import('../screens/messages/CreateGroupScreen'));
const VoiceCallScreen = withLazy(() => import('../screens/messages/VoiceCallScreen'));

const DisasterMapScreen = withLazy(() => import('../screens/map/DisasterMapScreen'));
const MeshNetworkScreen = withLazy(() => import('../screens/mesh/MeshNetworkScreen'));
const LocalAIAssistantScreen = withLazy(() => import('../screens/ai/LocalAIAssistantScreen'));
const WaveVisualizationScreen = withLazy(() => import('../screens/waves/WaveVisualizationScreen'));

const DrillModeScreen = withLazy(() => import('../screens/drill/DrillModeScreen'));
const UserReportsScreen = withLazy(() => import('../screens/reports/UserReportsScreen'));
const VolunteerModuleScreen = withLazy(() => import('../screens/volunteer/VolunteerModuleScreen'));

const AddFamilyMemberScreen = withLazy(() => import('../screens/family/AddFamilyMemberScreen'));
const FamilyGroupChatScreen = withLazy(() => import('../screens/family/FamilyGroupChatScreen'));
const HealthProfileScreen = withLazy(() => import('../screens/health/HealthProfileScreen'));
const MedicalInformationScreen = withLazy(() => import('../screens/medical/MedicalInformationScreen'));
const PsychologicalSupportScreen = withLazy(() => import('../screens/support/PsychologicalSupportScreen'));

const NewsDetailScreen = withLazy(() => import('../screens/news/NewsDetailScreen'));
const AllNewsScreen = withLazy(() => import('../screens/news/AllNewsScreen'));
const RiskScoreScreen = withLazy(() => import('../screens/ai/RiskScoreScreen'));
const PreparednessPlanScreen = withLazy(() => import('../screens/ai/PreparednessPlanScreen'));
const PanicAssistantScreen = withLazy(() => import('../screens/ai/PanicAssistantScreen'));

const EarthquakeSettingsScreen = withLazy(() => import('../screens/settings/EarthquakeSettingsScreen'));
const NotificationSettingsScreen = withLazy(() => import('../screens/settings/NotificationSettingsScreen'));
const DisasterPreparednessScreen = withLazy(() => import('../screens/preparedness/DisasterPreparednessScreen'));
const AssemblyPointsScreen = withLazy(() => import('../screens/assembly/AssemblyPointsScreen'));
const AddAssemblyPointScreen = withLazy(() => import('../screens/assembly/AddAssemblyPointScreen'));
const FlashlightWhistleScreen = withLazy(() => import('../screens/tools/FlashlightWhistleScreen'));
const MyQRScreen = withLazy(() => import('../screens/profile/MyQRScreen'));

const SOSHistoryScreen = withLazy(() => import('../screens/sos/SOSHistoryScreen'));

// Settings Sub-Screens
const OfflineMapSettingsScreen = withLazy(() => import('../screens/settings/OfflineMapSettingsScreen'));
const AdvancedSettingsScreen = withLazy(() => import('../screens/settings/AdvancedSettingsScreen'));
const AboutScreen = withLazy(() => import('../screens/settings/AboutScreen'));
const PrivacyPolicyScreen = withLazy(() => import('../screens/settings/PrivacyPolicyScreen'));
const TermsOfServiceScreen = withLazy(() => import('../screens/settings/TermsOfServiceScreen'));
const SecurityScreen = withLazy(() => import('../screens/settings/SecurityScreen'));
const EEWSettingsScreen = withLazy(() => import('../screens/settings/EEWSettingsScreen'));
const RescueTeamScreen = withLazy(() => import('../screens/rescue/RescueTeamScreen'));

const Stack = createStackNavigator();

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3b82f6" />
  </View>
);

export default function MainNavigator() {
  return (
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#000' },
          headerBackTitle: ' ',
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
          headerTransparent: true,
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />

        <Stack.Screen name="RiskScore" component={RiskScoreScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllEarthquakes" component={AllEarthquakesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EarthquakeDetail" component={EarthquakeDetailScreen} options={{ headerShown: false }} />

        <Stack.Screen name="DisasterMap" component={DisasterMapScreen} options={{ headerShown: false }} />

        <Stack.Screen name="DrillMode" component={DrillModeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="UserReports" component={UserReportsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VolunteerModule" component={VolunteerModuleScreen} options={{ headerShown: false }} />

        <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FamilyGroupChat" component={FamilyGroupChatScreen} options={{ headerShown: false }} />

        <Stack.Screen name="HealthProfile" component={HealthProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MedicalInformation" component={MedicalInformationScreen} options={{ headerShown: false }} />

        <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SOSConversation" component={SOSConversationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SOSHistory" component={SOSHistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SOSHelp" component={SOSHelpScreen} options={{ headerShown: false }} />

        <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllNews" component={AllNewsScreen} options={{ headerShown: false }} />

        <Stack.Screen name="PreparednessPlan" component={PreparednessPlanScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PanicAssistant" component={PanicAssistantScreen} options={{ headerShown: false }} />

        <Stack.Screen name="LocalAIAssistant" component={LocalAIAssistantScreen} options={{ headerShown: false }} />
        <Stack.Screen name="WaveVisualization" component={WaveVisualizationScreen} options={{ headerShown: false }} />

        <Stack.Screen name="EarthquakeSettings" component={EarthquakeSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />

        <Stack.Screen name="DisasterPreparedness" component={DisasterPreparednessScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AssemblyPoints" component={AssemblyPointsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddAssemblyPoint" component={AddAssemblyPointScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FlashlightWhistle" component={FlashlightWhistleScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PsychologicalSupport" component={PsychologicalSupportScreen} options={{ headerShown: false }} />

        <Stack.Screen name="MeshNetwork" component={MeshNetworkScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyQR" component={MyQRScreen} options={{ headerShown: false }} />

        <Stack.Screen name="OfflineMapSettings" component={OfflineMapSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdvancedSettings" component={AdvancedSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Security" component={SecurityScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EEWSettings" component={EEWSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RescueTeam" component={RescueTeamScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VoiceCall" component={VoiceCallScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1F4E79',
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
