import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

type EventListener<T> = (event: T) => void;

export type WriteReceivedEvent = {
  deviceId: string;
  characteristicUUID: string;
  data: string;
};

export type DeviceEvent = { deviceId: string };

// FAZ 1 TIER1-04: killed-app restoration sonrası native iOS event'i.
export type StateRestoredEvent = {
  serviceUUIDs: string[];
  characteristicUUIDs: string[];
  hadAdvertisementData: boolean;
  timestamp: number; // epoch seconds
};

export interface AfetNetBlePeripheralModuleType {
  startPeripheral(serviceUUID: string, characteristicUUIDs: string[], sosCharacteristicUUID: string): Promise<void>;
  stopPeripheral(): Promise<void>;
  isPeripheralRunning(): boolean;
  updateAdvertisementData(data: string): void;
  notifyCharacteristic(characteristicUUID: string, data: string): void;
  getConnectedDeviceCount(): number;
  addListener(eventName: 'onWriteReceived', listener: EventListener<WriteReceivedEvent>): EventSubscription;
  addListener(eventName: 'onDeviceConnected', listener: EventListener<DeviceEvent>): EventSubscription;
  addListener(eventName: 'onDeviceDisconnected', listener: EventListener<DeviceEvent>): EventSubscription;
  addListener(eventName: 'onStateRestored', listener: EventListener<StateRestoredEvent>): EventSubscription;
}

export default requireNativeModule<AfetNetBlePeripheralModuleType>('AfetNetBlePeripheral');
