/**
 * ONBOARDING NAVIGATOR - Placeholder
 * Waiting for Phase 4: Cinematic Onboarding
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      {/* ELITE: Replaced Cinematic Video with 7-Slide Direct Onboarding */}
      <Stack.Screen name="SevenSlideTour" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}
