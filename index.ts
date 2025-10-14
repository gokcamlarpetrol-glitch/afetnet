// GERÇEK AFETNET UYGULAMASI - RESTORED
import { Buffer } from 'buffer';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// Simple global setup
global.Buffer = Buffer;

// Import App component
import App from './App';

// Use Expo's registerRootComponent for compatibility
import { registerRootComponent } from 'expo';
registerRootComponent(App);