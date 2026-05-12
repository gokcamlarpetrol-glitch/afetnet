/**
 * ONBOARDING NAVIGATOR
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import TermsOfServiceScreen from '../screens/settings/TermsOfServiceScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SevenSlideTour" component={OnboardingScreen} />
      {/* Apple 5.1.5: EULA erişimi onboarding sırasında da sağlanmalı */}
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}
