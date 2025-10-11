import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';
import * as React from 'react';
import { useEffect } from 'react';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';
// @ts-ignore
global.Buffer = Buffer;
// @ts-ignore
import App from './App';
// @ts-ignore
import { registerQuakeBackground } from './src/background/quakeTask';

function AppWrapper() {
  useEffect(() => {
    registerQuakeBackground().catch((_error: any) => {
      // Silent fail - background tasks are optional
    });
  }, []);

  return React.createElement(App);
}

registerRootComponent(AppWrapper);