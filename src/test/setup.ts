import 'react-native-gesture-handler/jestSetup';

// Declare jest global
declare const jest: any;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  (globalThis as any).require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = (globalThis as any).require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  getCurrentPositionAsync: () => Promise.resolve({
    coords: { latitude: 41.0082, longitude: 28.9784, accuracy: 10 },
  }),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: () => Promise.resolve(),
  getExpoPushTokenAsync: () => Promise.resolve({ data: 'mock-token' }),
}));

// Global test utilities
(globalThis as any).__DEV__ = true;
