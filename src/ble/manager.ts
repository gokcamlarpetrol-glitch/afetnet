import { BleManager, Device } from 'react-native-ble-plx';
import BlePeripheral from 'react-native-ble-peripheral';
import { Buffer } from 'buffer';
import { logger } from '../utils/productionLogger';
import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID } from './constants';

class AfetBle {
  private static _instance: AfetBle;
  public manager: BleManager;
  private devices: Map<string, Device> = new Map();
  private onMessageCallback: ((message: string) => void) | null = null;

  private constructor() {
    this.manager = new BleManager();
  }

  static get instance() {
    if (!this._instance) {
      this._instance = new AfetBle();
    }
    return this._instance;
  }

  public async start() {
    await BlePeripheral.addService(AFETNET_SERVICE_UUID, true);
    await BlePeripheral.addCharacteristicToService(AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID, 16 | 8, 8);
    await BlePeripheral.start();

    this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        this.scanAndConnect();
      }
    }, true);
  }

  public stop() {
    BlePeripheral.stop();
    this.manager.stopDeviceScan();
    this.devices.forEach(device => this.manager.cancelDeviceConnection(device.id));
  }

  public onMessage(callback: (message: string) => void) {
    this.onMessageCallback = callback;
  }

  public async broadcast(message: string) {
    const data = Buffer.from(message).toString('base64');
    BlePeripheral.updateValue(AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID, data);
  }

  private scanAndConnect() {
    this.manager.startDeviceScan([AFETNET_SERVICE_UUID], null, (error, device) => {
      if (error) {
        logger.error('BLE scan error:', error);
        return;
      }

      if (device && !this.devices.has(device.id)) {
        this.devices.set(device.id, device);

        device.connect()
          .then(device => {
            return device.discoverAllServicesAndCharacteristics();
          })
          .then(device => {
            this.manager.monitorCharacteristicForDevice(
              device.id,
              AFETNET_SERVICE_UUID,
              AFETNET_CHAR_MSG_UUID,
              (error, characteristic) => {
                if (error) {
                  logger.error(`Failed to monitor characteristic for device ${device.id}:`, error);
                  return;
                }
                if (characteristic?.value) {
                  const message = Buffer.from(characteristic.value, 'base64').toString('utf8');
                  if (this.onMessageCallback) {
                    this.onMessageCallback(message);
                  }
                }
              }
            );
          })
          .catch(error => {
            logger.error(`Failed to connect to device ${device.id}:`, error);
          });
      }
    });
  }
}

export const bleManager = AfetBle.instance;
