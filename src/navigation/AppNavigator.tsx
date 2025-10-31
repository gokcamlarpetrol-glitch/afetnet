import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import RootTabs from './RootTabs';
import PremiumActiveScreen from '../screens/PremiumActive';
import Paywall from '../features/paywall/Paywall';
import QRScanner from '../screens/QRScanner';
import MapOffline from '../screens/MapOffline';
import { offlineSyncManager } from '../services/OfflineSyncManager';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen 
          name="MainTabs" 
          component={RootTabs} 
        />
        <Stack.Screen
          name="Paywall"
          component={Paywall}
          options={{
            headerShown: true,
            title: 'Premium',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen 
          name="QRScanner" 
          component={QRScanner}
          options={{ 
            headerShown: true, 
            title: 'QR Kod Tara',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="MapOffline"
          component={MapOffline}
          options={{
            headerShown: true,
            title: 'Offline Harita',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="Premium"
          component={PremiumActiveScreen}
          options={{
            headerShown: true,
            title: 'Premium',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}