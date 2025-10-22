import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import RootTabs from './RootTabs';
import PaywallDebugScreen from '../screens/PaywallDebugScreen';
import PremiumActiveScreen from '../screens/PremiumActive';

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
        {__DEV__ && (
          <Stack.Screen 
            name="PaywallDebug" 
            component={PaywallDebugScreen} 
            options={{ headerShown: true, title: 'Paywall Debug' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}