import { type EventSubscription } from 'expo-modules-core';

import AfetNetBlePeripheralNativeModule from './AfetNetBlePeripheralNativeModule';

// Event types
export type OnWriteReceivedEvent = {
  deviceId: string;
  characteristicUUID: string;
  data: string; // hex-encoded
};

export type OnDeviceConnectedEvent = {
  deviceId: string;
};

export type OnDeviceDisconnectedEvent = {
  deviceId: string;
};

// FAZ 1 TIER1-04: killed-app restoration sonrası iOS event'i.
// CBPeripheralManagerOptionRestoreIdentifierKey ile registered, peer advertise edip
// iOS uygulamayı background relaunch ettiğinde fire eder. JS bunu yakalayıp
// MeshNetworkService scanner + listener'larını ~30s background penceresinde
// bootstrap eder. Sadece iOS — Android'de native side fire etmez.
export type OnStateRestoredEvent = {
  serviceUUIDs: string[];
  characteristicUUIDs: string[];
  hadAdvertisementData: boolean;
  timestamp: number; // epoch seconds (Swift Date().timeIntervalSince1970)
};

// API
export function startPeripheral(serviceUUID: string, characteristicUUIDs: string[], sosCharacteristicUUID: string): Promise<void> {
  return AfetNetBlePeripheralNativeModule.startPeripheral(serviceUUID, characteristicUUIDs, sosCharacteristicUUID);
}

export function stopPeripheral(): Promise<void> {
  return AfetNetBlePeripheralNativeModule.stopPeripheral();
}

export function isPeripheralRunning(): boolean {
  return AfetNetBlePeripheralNativeModule.isPeripheralRunning();
}

export function updateAdvertisementData(data: string): void {
  AfetNetBlePeripheralNativeModule.updateAdvertisementData(data);
}

export function notifyCharacteristic(characteristicUUID: string, data: string): void {
  AfetNetBlePeripheralNativeModule.notifyCharacteristic(characteristicUUID, data);
}

export function getConnectedDeviceCount(): number {
  return AfetNetBlePeripheralNativeModule.getConnectedDeviceCount();
}

// Event listeners — use the native module's addListener directly
export function addOnWriteReceivedListener(
  listener: (event: OnWriteReceivedEvent) => void
): EventSubscription {
  return AfetNetBlePeripheralNativeModule.addListener('onWriteReceived', listener);
}

export function addOnDeviceConnectedListener(
  listener: (event: OnDeviceConnectedEvent) => void
): EventSubscription {
  return AfetNetBlePeripheralNativeModule.addListener('onDeviceConnected', listener);
}

export function addOnDeviceDisconnectedListener(
  listener: (event: OnDeviceDisconnectedEvent) => void
): EventSubscription {
  return AfetNetBlePeripheralNativeModule.addListener('onDeviceDisconnected', listener);
}

// FAZ 1 TIER1-04
export function addOnStateRestoredListener(
  listener: (event: OnStateRestoredEvent) => void
): EventSubscription {
  return AfetNetBlePeripheralNativeModule.addListener('onStateRestored', listener);
}
