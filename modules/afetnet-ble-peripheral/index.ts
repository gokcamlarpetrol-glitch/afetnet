export {
  startPeripheral,
  stopPeripheral,
  isPeripheralRunning,
  updateAdvertisementData,
  notifyCharacteristic,
  getConnectedDeviceCount,
  addOnWriteReceivedListener,
  addOnDeviceConnectedListener,
  addOnDeviceDisconnectedListener,
  addOnStateRestoredListener,
} from './src/AfetNetBlePeripheralModule';

export type {
  OnWriteReceivedEvent,
  OnDeviceConnectedEvent,
  OnDeviceDisconnectedEvent,
  OnStateRestoredEvent,
} from './src/AfetNetBlePeripheralModule';
