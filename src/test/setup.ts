/**
 * ELITE TEST SETUP
 * Global test configuration and mocks for Jest
 */

// Mock React Native modules
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn(() => ({})),
  getEnforcing: jest.fn(() => ({})),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native/jest/mock');
  return {
    ...RN,
    Platform: {
      ...(RN.Platform || {}),
      OS: 'ios',
      select: jest.fn((spec) => spec.ios || spec.default),
    },
    NativeModules: {
      ...(RN.NativeModules || {}),
      StatusBarManager: {
        HEIGHT: 20,
        getHeight: jest.fn(),
      },
    },
    Linking: {
      ...(RN.Linking || {}),
      openURL: jest.fn(),
      canOpenURL: jest.fn().mockResolvedValue(true),
    },
  };
});

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    },
  }),
  Accuracy: {
    Balanced: 3,
    High: 4,
    Low: 2,
  },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(null),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(null),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn();
    }),
  })),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  OAuthProvider: jest.fn(() => ({
    credential: jest.fn(),
  })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => false,
    data: () => null,
  }),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'Apple',
  modelName: 'iPhone 14',
  osName: 'iOS',
  osVersion: '17.0',
}));

// Mock console methods for cleaner test output
const originalConsole = { ...console };
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => { });
  jest.spyOn(console, 'debug').mockImplementation(() => { });
  jest.spyOn(console, 'info').mockImplementation(() => { });
  // Keep error and warn for debugging
});

afterAll(() => {
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
});

// Global test timeout
jest.setTimeout(10000);

// ELITE: Custom matchers
expect.extend({
  toBeValidEarthquake(received) {
    const pass =
            typeof received === 'object' &&
            typeof received.id === 'string' &&
            typeof received.magnitude === 'number' &&
            typeof received.latitude === 'number' &&
            typeof received.longitude === 'number' &&
            received.magnitude >= 0 &&
            received.magnitude <= 10;

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid earthquake`
          : `Expected ${JSON.stringify(received)} to be a valid earthquake with id, magnitude (0-10), latitude, longitude`,
    };
  },
});

// TypeScript declaration for custom matchers
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidEarthquake(): R;
        }
    }
}
