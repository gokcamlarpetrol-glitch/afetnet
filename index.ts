// AFETNET - Main Entry Point
import { Buffer } from 'buffer';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// Simple global setup (safe check)
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}

// Import CoreApp from src/core/App
import CoreApp from './src/core/App';

// Use Expo's registerRootComponent for compatibility
import { registerRootComponent } from 'expo';

try {
  registerRootComponent(CoreApp);
} catch (error) {
  console.error('[AfetNet] Failed to register root component:', error);
  // Fallback for React Native
  try {
    const { AppRegistry } = require('react-native');
    AppRegistry.registerComponent('main', () => CoreApp);
  } catch (fallbackError) {
    console.error('[AfetNet] Fallback registration also failed:', fallbackError);
    // Last resort: try to export component anyway
    // This ensures the app can still be imported even if registration fails
  }
}
