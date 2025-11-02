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
registerRootComponent(CoreApp);