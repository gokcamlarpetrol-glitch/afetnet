import React from 'react';
import { logger } from "../utils/productionLogger";
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Navigation handled by parent component
// import MapOffline from '../screens/MapOffline';
import { View, Text, Pressable } from 'react-native';

// Available screens
import FamilyScreen from '../screens/Family';
import HomeScreen from '../screens/HomeSimple';
import MapScreen from '../screens/Map';
import MessagesScreen from '../screens/Messages';
import SettingsScreen from '../screens/Settings/SettingsCore';

// Premium control
import { usePremiumFeatures } from '../store/premium';

const Tab = createBottomTabNavigator();

// PremiumGate kaldırıldı; artık sekmeye basınca premium değilse Paywall'a yönlendirilir

function LockedOverlay({ navigation }: { navigation: any }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="auto">
      <View style={{ flex: 1 }} />
      <View style={{ padding: 16, backgroundColor: 'rgba(15,23,42,0.9)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
          Bu ekranı görüntüleyebilirsiniz; kullanmak için Premium gerekir.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Paywall')}
          style={{ backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Premium’a Geç</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootTabs() {
  const { isPremium } = usePremiumFeatures();
  
  return (
    <Tab.Navigator
      screenOptions={{
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
      >
        {() => <HomeScreen />}
      </Tab.Screen>
      
      {/* 2. HARİTA - PREMIUM (görünür, premium değilse etkileşim kilitli) */}
      <Tab.Screen
        name="Harita"
        options={{
          tabBarLabel: 'Harita',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      >
        {({ navigation }) => (
          <View style={{ flex: 1 }}>
            <MapScreen />
            {isPremium ? null : <LockedOverlay navigation={navigation} />}
          </View>
        )}
      </Tab.Screen>

      {/* Offline ayrı bir sekme olarak gösterilmiyor; Harita içinde erişilir */}
      
      {/* 3. MESAJLAR - PREMIUM (görünür, premium değilse etkileşim kilitli) */}
      <Tab.Screen 
        name="Messages" 
        options={{
          tabBarLabel: 'Mesajlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      >
        {({ navigation }) => (
          <View style={{ flex: 1 }}>
            <MessagesScreen />
            {isPremium ? null : <LockedOverlay navigation={navigation} />}
          </View>
        )}
      </Tab.Screen>
      
      {/* 4. AİLE - PREMIUM (görünür, premium değilse etkileşim kilitli) */}
      <Tab.Screen 
        name="Family" 
        options={{
          tabBarLabel: 'Aile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'people' : 'people-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      >
        {({ navigation }) => (
          <View style={{ flex: 1 }}>
            <FamilyScreen />
            {isPremium ? null : <LockedOverlay navigation={navigation} />}
          </View>
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