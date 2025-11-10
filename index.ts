// AFETNET - Main Entry Point
import { Buffer } from 'buffer';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// Simple global setup
global.Buffer = Buffer;

// Import CoreApp from src/core/App
import CoreApp from './src/core/App';

// Use Expo's registerRootComponent for compatibility
import { registerRootComponent } from 'expo';

try {
  registerRootComponent(CoreApp);
} catch (error) {
  console.error('[AfetNet] Failed to register root component:', error);
  // Fallback for React Native
  const { AppRegistry } = require('react-native');
  AppRegistry.registerComponent('main', () => CoreApp);
}