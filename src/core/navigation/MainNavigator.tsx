import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
// ELITE: Auth is now handled centrally in CoreApp via authStore
// No need for local auth state here

import MainTabs from './MainTabs';

// Feature Screens (Eager Load - Critical Path)
import { AllEarthquakesScreen, EarthquakeDetailScreen } from '../screens/earthquakes';

import NewMessageScreen from '../screens/messages/NewMessageScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import SOSConversationScreen from '../screens/messages/SOSConversationScreen';

// Lazy Load Heavy Screens - CRITICAL: Must have proper default export
const DisasterMapScreen = React.lazy(() => import('../screens/map/DisasterMapScreen'));
const MeshNetworkScreen = React.lazy(() => import('../screens/mesh/MeshNetworkScreen'));
// CRITICAL: Eager import for AI Assistant screen to prevent lazy loading navigation issues
import LocalAIAssistantScreen from '../screens/ai/LocalAIAssistantScreen';

// CRITICAL: Eager import for P/S Wave screen to prevent lazy loading issues
import WaveVisualizationScreen from '../screens/waves/WaveVisualizationScreen';

// Other Screens (Keep eager for now or lazy if needed)
import DrillModeScreen from '../screens/drill/DrillModeScreen';
import UserReportsScreen from '../screens/reports/UserReportsScreen';
import VolunteerModuleScreen from '../screens/volunteer/VolunteerModuleScreen';
import AddFamilyMemberScreen from '../screens/family/AddFamilyMemberScreen';
import FamilyGroupChatScreen from '../screens/family/FamilyGroupChatScreen';
import HealthProfileScreen from '../screens/health/HealthProfileScreen';
import MedicalInformationScreen from '../screens/medical/MedicalInformationScreen';
import PsychologicalSupportScreen from '../screens/support/PsychologicalSupportScreen';
import NewsDetailScreen from '../screens/news/NewsDetailScreen';
import AllNewsScreen from '../screens/news/AllNewsScreen';
import RiskScoreScreen from '../screens/ai/RiskScoreScreen';
import PreparednessPlanScreen from '../screens/ai/PreparednessPlanScreen';
import PanicAssistantScreen from '../screens/ai/PanicAssistantScreen';
import EarthquakeSettingsScreen from '../screens/settings/EarthquakeSettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import DisasterPreparednessScreen from '../screens/preparedness/DisasterPreparednessScreen';
import AssemblyPointsScreen from '../screens/assembly/AssemblyPointsScreen';
import AddAssemblyPointScreen from '../screens/assembly/AddAssemblyPointScreen';
// ELITE: Auth screens for in-app registration/password reset navigation
import { EmailRegisterScreen } from '../screens/auth/EmailRegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import DesignSystemScreen from '../screens/design/DesignSystemScreen';
import FlashlightWhistleScreen from '../screens/tools/FlashlightWhistleScreen';
import MyQRScreen from '../screens/profile/MyQRScreen';

// ELITE: Settings Sub-Screens
import OfflineMapSettingsScreen from '../screens/settings/OfflineMapSettingsScreen';
import AdvancedSettingsScreen from '../screens/settings/AdvancedSettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import PrivacyPolicyScreen from '../screens/settings/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/settings/TermsOfServiceScreen';
import SecurityScreen from '../screens/settings/SecurityScreen';
import EEWSettingsScreen from '../screens/settings/EEWSettingsScreen';
import RescueTeamScreen from '../screens/rescue/RescueTeamScreen';

const Stack = createStackNavigator();

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3b82f6" />
  </View>
);

// ELITE: MainNavigator assumes user is authenticated (checked in CoreApp)
export default function MainNavigator() {
  // Auth is centrally managed in CoreApp via authStore
  // This component only renders when isAuthenticated === true

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#000' },
          headerBackTitle: ' ', // Hides "MainTabs" text
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
          headerTransparent: true,
          // headerBlurEffect removed to satisfy TS strictly
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />

        {/* ELITE: All screens use headerShown: false because they have custom headers */}
        <Stack.Screen name="Risk" component={RiskScoreScreen} options={{ headerShown: false }} />
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

        <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllNews" component={AllNewsScreen} options={{ headerShown: false }} />

        <Stack.Screen name="RiskScore" component={RiskScoreScreen} options={{ headerShown: false }} />
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
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyQR" component={MyQRScreen} options={{ headerShown: false }} />

        {/* ELITE: Settings Sub-Screens */}
        <Stack.Screen name="OfflineMapSettings" component={OfflineMapSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdvancedSettings" component={AdvancedSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Security" component={SecurityScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EEWSettings" component={EEWSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RescueTeam" component={RescueTeamScreen} options={{ headerShown: false }} />


      </Stack.Navigator>
    </Suspense>
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
});
