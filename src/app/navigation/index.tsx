import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './TabNavigator';
import { HelpRequestModal } from '@/app/components/HelpRequestModal';

export type RootStackParamList = {
  Main: undefined;
  HelpRequestModal: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        <Stack.Screen name="Main" component={BottomTabNavigator} />
        <Stack.Screen 
          name="HelpRequestModal" 
          component={HelpRequestModal}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Yardım İste',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
