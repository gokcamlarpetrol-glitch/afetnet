import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';

// Bottom Tab Navigator Param List
export type TabParamList = {
    Home: undefined;
    Map: undefined;
    Family: undefined;
    Messages: undefined;
    Settings: undefined;
};

// Main Stack Navigator Param List
export type MainStackParamList = {
    MainTabs: undefined;
    Wave: undefined;
    Risk: undefined;
};

// Onboarding Stack Navigator Param List
export type OnboardingStackParamList = {
    'Onboarding-Welcome': undefined;
    'Onboarding-Preparedness': undefined;
    'Onboarding-Community': undefined;
};

// Navigation Props
export type HomeScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;
export type MapScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Map'>;
export type FamilyScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Family'>;
export type MessagesScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Messages'>;
export type SettingsScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Settings'>;

export type WaveScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Wave'>;
export type RiskScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Risk'>;
