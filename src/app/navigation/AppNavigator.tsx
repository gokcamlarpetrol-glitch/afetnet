import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import TabNavigator from './TabNavigator';
import HelpRequestModal from '../components/HelpRequestModal';
import { useTranslation } from 'react-i18next';

export type RootStackParamList = {
  MainTabs: undefined;
  HelpRequest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <>
      <StatusBar style="light" backgroundColor="#1C1C1E" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1C1C1E',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '600',
            },
            presentation: 'modal',
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="HelpRequest"
            component={HelpRequestModal}
            options={{
              title: t('help.title'),
              presentation: 'fullScreenModal',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default AppNavigator;
