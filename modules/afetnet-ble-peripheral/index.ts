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
} from './src/AfetNetBlePeripheralModule';

export type {
  OnWriteReceivedEvent,
  OnDeviceConnectedEvent,
  OnDeviceDisconnectedEvent,
} from './src/AfetNetBlePeripheralModule';
