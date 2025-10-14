// GERÇEK AFETNET UYGULAMASI - MEVCUT TASARIM KORUNDU
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    try { 
      LogBox.ignoreAllLogs(true); 
    } catch (e) {
      console.warn('Could not disable logs');
    }
    
    console.log('AfetNet - Mevcut tasarım korundu, stack overflow çözüldü');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}