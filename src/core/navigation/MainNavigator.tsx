import React, { useEffect, useState, Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirebase } from '../../lib/firebase';

import MainTabs from './MainTabs';

// Feature Screens (Eager Load - Critical Path)
import { AllEarthquakesScreen, EarthquakeDetailScreen } from '../screens/earthquakes';

import NewMessageScreen from '../screens/messages/NewMessageScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import SOSConversationScreen from '../screens/messages/SOSConversationScreen';

// Lazy Load Heavy Screens
const DisasterMapScreen = React.lazy(() => import('../screens/map/DisasterMapScreen'));
const WaveVisualizationScreen = React.lazy(() => import('../screens/waves/WaveVisualizationScreen'));
const MeshNetworkScreen = React.lazy(() => import('../screens/mesh/MeshNetworkScreen'));
const LocalAIAssistantScreen = React.lazy(() => import('../screens/ai/LocalAIAssistantScreen'));

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
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen'; // ELITE: Import Onboarding
import { LoginScreen } from '../screens/auth/LoginScreen'; // ELITE: Auth Screen
import { EmailRegisterScreen } from '../screens/auth/EmailRegisterScreen'; // ELITE: Email Register
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen'; // ELITE: Password Reset
import DesignSystemScreen from '../screens/design/DesignSystemScreen';
import FlashlightWhistleScreen from '../screens/tools/FlashlightWhistleScreen';
import MyQRScreen from '../screens/profile/MyQRScreen';

const Stack = createStackNavigator();

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3b82f6" />
  </View>
);

export default function MainNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // ELITE: Safe Firebase initialization with null-check
    const app = initializeFirebase();

    if (!app) {
      // Firebase failed to initialize - show loading fallback
      setInitializing(false);
      return;
    }

    // CRITICAL: Pass the app instance to getAuth for type safety
    const auth = getAuth(app);
    const subscriber = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) {
        setInitializing(false);
      }
    });

    // Unsubscribe from auth state changes when the component unmounts
    return subscriber;
  }, [initializing]);

  // ELITE: Auth Gate - No mock user, proper auth flow
  // If no user is signed in after initialization, they need to authenticate
  // The LoginScreen handles the sign-in flow with Apple/Google

  if (!user) {
    // ELITE: Show OnboardingScreen first - it includes login slide at the end
    // This ensures users see the onboarding experience before authenticating
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Stack.Navigator
          id={undefined}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#000' },
          }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EmailRegister" component={EmailRegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </Suspense>
    );
  }

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


        <Stack.Screen name="Risk" component={RiskScoreScreen} options={{ headerShown: true, title: 'Risk Analizi' }} />
        <Stack.Screen name="AllEarthquakes" component={AllEarthquakesScreen} options={{ headerShown: true, title: 'Tüm Depremler' }} />
        <Stack.Screen name="EarthquakeDetail" component={EarthquakeDetailScreen} options={{ headerShown: false }} />

        <Stack.Screen name="DisasterMap" component={DisasterMapScreen} options={{ headerShown: true, title: 'Afet Haritası' }} />



        <Stack.Screen name="DrillMode" component={DrillModeScreen} options={{ headerShown: true, title: 'Tatbikat Modu' }} />
        <Stack.Screen name="UserReports" component={UserReportsScreen} options={{ headerShown: true, title: 'Kullanıcı Raporları' }} />
        <Stack.Screen name="VolunteerModule" component={VolunteerModuleScreen} options={{ headerShown: true, title: 'Gönüllü Modülü' }} />

        <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FamilyGroupChat" component={FamilyGroupChatScreen} options={{ headerShown: true, title: 'Aile Sohbeti' }} />

        <Stack.Screen name="HealthProfile" component={HealthProfileScreen} options={{ headerShown: true, title: 'Sağlık Profili' }} />
        <Stack.Screen name="MedicalInformation" component={MedicalInformationScreen} options={{ headerShown: true, title: 'Tıbbi Bilgiler' }} />

        <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ headerShown: true, title: 'Yeni Mesaj' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ headerShown: true, title: 'Sohbet' }} />
        <Stack.Screen name="SOSConversation" component={SOSConversationScreen} options={{ headerShown: true, title: 'SOS Sohbeti' }} />

        <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllNews" component={AllNewsScreen} options={{ headerShown: false }} />

        <Stack.Screen name="RiskScore" component={RiskScoreScreen} options={{ headerShown: true, title: 'Risk Skoru' }} />
        <Stack.Screen name="PreparednessPlan" component={PreparednessPlanScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PanicAssistant" component={PanicAssistantScreen} options={{ headerShown: true, title: 'Afet Rehberi' }} />

        <Stack.Screen name="LocalAIAssistant" component={LocalAIAssistantScreen} options={{ headerShown: false }} />
        <Stack.Screen name="WaveVisualization" component={WaveVisualizationScreen} options={{ headerShown: true, title: 'Dalga Görselleştirme' }} />

        <Stack.Screen name="EarthquakeSettings" component={EarthquakeSettingsScreen} options={{ headerShown: true, title: 'Deprem Ayarları' }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: true, title: 'Bildirim Ayarları' }} />


        <Stack.Screen name="DisasterPreparedness" component={DisasterPreparednessScreen} options={{ headerShown: true, title: 'Afet Hazırlığı' }} />
        <Stack.Screen name="AssemblyPoints" component={AssemblyPointsScreen} options={{ headerShown: true, title: 'Toplanma Alanları' }} />
        <Stack.Screen name="AddAssemblyPoint" component={AddAssemblyPointScreen} options={{ headerShown: true, title: 'Toplanma Alanı Ekle' }} />
        <Stack.Screen name="FlashlightWhistle" component={FlashlightWhistleScreen} options={{ headerShown: true, title: 'Fener ve Düdük' }} />
        <Stack.Screen name="PsychologicalSupport" component={PsychologicalSupportScreen} options={{ headerShown: true, title: 'Psikolojik Destek' }} />

        <Stack.Screen name="MeshNetwork" component={MeshNetworkScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyQR" component={MyQRScreen} options={{ headerShown: false }} />

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
