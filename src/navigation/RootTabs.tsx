import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Pressable } from 'react-native';

// Available screens
import FamilyScreen from '../screens/Family';
import HomeScreen from '../screens/HomeSimple';
import MapScreen from '../screens/Map';
import MessagesScreen from '../screens/Messages';
import SettingsScreen from '../screens/Settings';
import PremiumActiveScreen from '../screens/PremiumActive';

// Premium control
import { usePremiumFeatures } from '../store/premium';

const Tab = createBottomTabNavigator();

// Premium Gate Component - Shows premium required message
function PremiumGate({ children, featureName }: { children: React.ReactNode; featureName: string }) {
  const { isPremium, canUseFeature } = usePremiumFeatures();
  
  if (canUseFeature(featureName)) {
    return <>{children}</>;
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Ionicons name="lock-closed" size={64} color="#f59e0b" />
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
        Premium Gerekli
      </Text>
      <Text style={{ color: '#94a3b8', fontSize: 16, marginTop: 8, textAlign: 'center', lineHeight: 24 }}>
        Bu özelliği kullanmak için Premium satın almanız gerekiyor.
      </Text>
      <Text style={{ color: '#64748b', fontSize: 14, marginTop: 16, textAlign: 'center' }}>
        Sadece deprem bildirimleri ücretsizdir.
      </Text>
      <Pressable 
        style={{ 
          backgroundColor: '#10b981', 
          paddingHorizontal: 32, 
          paddingVertical: 16, 
          borderRadius: 12, 
          marginTop: 24 
        }}
        onPress={() => {
          // Navigate to premium screen
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>
          Premium Satın Al
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootTabs() {
  const { isPremium, canUseFeature } = usePremiumFeatures();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      {/* 1. ANA SAYFA - FREE (Deprem bildirimleri) */}
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarLabel: 'Deprem',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'pulse' : 'pulse-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* 2. HARİTA - PREMIUM */}
      <Tab.Screen 
        name="Harita" 
        options={{
          tabBarLabel: 'Harita',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'map' : 'map-outline'} 
              size={24} 
              color={isPremium ? color : '#6b7280'} 
            />
          ),
        }}
      >
        {() => (
          <PremiumGate featureName="advanced_maps">
            <MapScreen />
          </PremiumGate>
        )}
      </Tab.Screen>
      
      {/* 3. MESAJLAR - PREMIUM */}
      <Tab.Screen 
        name="Messages" 
        options={{
          tabBarLabel: 'Mesajlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} 
              size={24} 
              color={isPremium ? color : '#6b7280'} 
            />
          ),
        }}
      >
        {() => (
          <PremiumGate featureName="p2p_messaging">
            <MessagesScreen />
          </PremiumGate>
        )}
      </Tab.Screen>
      
      {/* 4. AİLE - PREMIUM */}
      <Tab.Screen 
        name="Family" 
        options={{
          tabBarLabel: 'Aile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'people' : 'people-outline'} 
              size={24} 
              color={isPremium ? color : '#6b7280'} 
            />
          ),
        }}
      >
        {() => (
          <PremiumGate featureName="family_tracking">
            <FamilyScreen />
          </PremiumGate>
        )}
      </Tab.Screen>
      
      {/* 5. AYARLAR - FREE (Basic settings only) */}
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarLabel: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'settings' : 'settings-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}