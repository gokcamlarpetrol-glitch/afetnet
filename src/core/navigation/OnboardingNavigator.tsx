/**
 * ONBOARDING NAVIGATOR - First Launch Experience
 * Sinematik, duygusal ve bilgilendirici onboarding akışı
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen1 from '../screens/onboarding/OnboardingScreen1';
import OnboardingScreen2 from '../screens/onboarding/OnboardingScreen2';
import OnboardingScreen3 from '../screens/onboarding/OnboardingScreen3';
import OnboardingScreen4 from '../screens/onboarding/OnboardingScreen4';
import OnboardingScreen5 from '../screens/onboarding/OnboardingScreen5';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, layouts }: any) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="Onboarding1" component={OnboardingScreen1} />
      <Stack.Screen name="Onboarding2" component={OnboardingScreen2} />
      <Stack.Screen name="Onboarding3" component={OnboardingScreen3} />
      <Stack.Screen name="Onboarding4" component={OnboardingScreen4} />
      <Stack.Screen name="Onboarding5" component={OnboardingScreen5} />
    </Stack.Navigator>
  );
}

