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
    RiskScore: undefined;
    AllEarthquakes: undefined;
    EarthquakeDetail: { earthquake?: Record<string, unknown> } | undefined;
    DisasterMap: {
        earthquake?: Record<string, unknown>;
        focusOnSOS?: boolean;
        sosLatitude?: number;
        sosLongitude?: number;
        sosSenderName?: string;
        focusOnFamily?: boolean;
        familyLatitude?: number;
        familyLongitude?: number;
        familyMemberName?: string;
        focusOnMember?: string;
    } | undefined;
    DrillMode: undefined;
    UserReports: undefined;
    VolunteerModule: undefined;
    AddFamilyMember: undefined;
    FamilyGroupChat: { groupId?: string } | undefined;
    HealthProfile: undefined;
    MedicalInformation: undefined;
    NewMessage: undefined;
    Conversation: { userId: string; userName?: string };
    SOSConversation: {
        sosUserId: string;
        sosUserName?: string;
        sosSenderUid?: string;
        sosUserAliases?: string[];
        sosMessage?: string;
        sosLocation?: { latitude: number; longitude: number; accuracy?: number } | null;
        sosBatteryLevel?: number;
        sosNetworkStatus?: string;
        sosTrapped?: boolean;
    } | undefined;
    CreateGroup: undefined;
    SOSHistory: undefined;
    SOSHelp: {
        signalId?: string;
        senderUid?: string;
        senderDeviceId?: string;
        senderName?: string;
        latitude?: number;
        longitude?: number;
        message?: string;
        trapped?: boolean;
        battery?: number;
        healthInfo?: Record<string, string>;
    } | undefined;
    NewsDetail: { newsId?: string; article?: Record<string, unknown> } | undefined;
    AllNews: undefined;
    PreparednessPlan: undefined;
    PanicAssistant: undefined;
    LocalAIAssistant: undefined;
    WaveVisualization: undefined;
    EarthquakeSettings: undefined;
    NotificationSettings: undefined;
    DisasterPreparedness: undefined;
    AssemblyPoints: undefined;
    AddAssemblyPoint: { pointId?: string } | undefined;
    FlashlightWhistle: undefined;
    PsychologicalSupport: undefined;
    MeshNetwork: undefined;
    MyQR: undefined;
    OfflineMapSettings: undefined;
    AdvancedSettings: undefined;
    About: undefined;
    PrivacyPolicy: undefined;
    TermsOfService: undefined;
    Security: undefined;
    EEWSettings: undefined;
    RescueTeam: undefined;
};

// Onboarding Stack Navigator Param List
export type OnboardingStackParamList = {
    SevenSlideTour: undefined;
};

// Navigation Props
export type HomeScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;
export type MapScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Map'>;
export type FamilyScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Family'>;
export type MessagesScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Messages'>;
export type SettingsScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Settings'>;

export type WaveScreenNavigationProp = StackNavigationProp<MainStackParamList, 'WaveVisualization'>;
export type RiskScreenNavigationProp = StackNavigationProp<MainStackParamList, 'RiskScore'>;
