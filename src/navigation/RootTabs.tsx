import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

// 5 EKRAN (Premium ayarlara taşındı)
import FamilyScreen from '../screens/Family';
import HomeScreen from '../screens/HomeSimple';
import MapOffline from '../screens/MapOffline';
import MessagesScreen from '../screens/Messages';
import SettingsScreen from '../screens/Settings';

// Stores for badges
import { useFamily } from '../store/family';
import { useQueue } from '../store/queue';

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const { items: queueItems } = useQueue();
  const { list: familyList } = useFamily();
  
  return (
    <NavigationContainer>
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
        {/* 1. ANA SAYFA */}
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{
            tabBarLabel: 'Ana Sayfa',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'home' : 'home-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        
        {/* 2. HARİTA */}
        <Tab.Screen 
          name="Harita" 
          component={MapOffline} 
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
        />
        
        {/* 3. MESAJLAR */}
        <Tab.Screen 
          name="Messages" 
          component={MessagesScreen} 
          options={{
            tabBarLabel: 'Mesajlar',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} 
                size={24} 
                color={color} 
              />
            ),
            tabBarBadge: queueItems.length > 0 ? queueItems.length : undefined,
          }}
        />
        
        {/* 4. AİLE */}
        <Tab.Screen 
          name="Family" 
          component={FamilyScreen} 
          options={{
            tabBarLabel: 'Aile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'people' : 'people-outline'} 
                size={24} 
                color={color} 
              />
            ),
            tabBarBadge: familyList.length > 0 ? familyList.length : undefined,
          }}
        />
        
               {/* 5. AYARLAR */}
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
    </NavigationContainer>
  );
}
