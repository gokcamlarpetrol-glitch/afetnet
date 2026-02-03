/**
 * mockNativeModules.ts
 * 
 * The "Hard Patch" in node_modules/react-native/Libraries/EventEmitter/NativeEventEmitter.js
 * is now handling the crash prevention.
 * 
 * We no longer need to (and cannot) inject mocks directly into NativeModules
 * because it causes a "Tried to insert a NativeModule" error on modern RN/Hermes.
 */

export function setupNativeModuleMocks() {
  if (__DEV__) {
    console.log('NativeModule mocks skipped - relying on NativeEventEmitter hard patch.');
  }
}
