import { Buffer } from 'buffer';
import { logger } from '../utils/productionLogger';
import { ble } from './manager';
import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID, SCAN_SECONDS, CONNECT_TIMEOUT_MS } from './constants';
import { Platform } from 'react-native';

export type NearbyHit = { id: string; name?: string | null; rssi?: number | null };

const isSimulator = Platform.OS === 'ios' && !(globalThis as any).process?.env?.EXPO_DEVICE_OWNER;

 
export async function scanNearby(onHit: (d: NearbyHit) => void) {
  if (isSimulator) {
    // Mock: emit a fake device
    onHit({ id: 'MOCK-DEVICE', name: 'Simulator', rssi: -55 });
    return new Promise<void>((res) => (globalThis as any).setTimeout(res, SCAN_SECONDS * 1000));
  }
  return new Promise<void>((resolve) => {
    const sub = ble.onStateChange((state) => {
      if (state === 'PoweredOn') {
        ble.startDeviceScan([AFETNET_SERVICE_UUID], {}, (err, device) => {
          if (err) {
            logger.warn('BLE scan error', err);
            return;
          }
          if (device?.serviceUUIDs?.includes(AFETNET_SERVICE_UUID)) {
            onHit({ id: device.id, name: device.name, rssi: device.rssi });
          }
        });
        (globalThis as any).setTimeout(() => {
          ble.stopDeviceScan();
          sub.remove();
          resolve();
        }, SCAN_SECONDS * 1000);
      }
    }, true);
  });
}

export async function sendTinyMessage(deviceId: string, payload: object) {
  if (isSimulator) {
    logger.debug('MOCK sendTinyMessage →', deviceId, payload);
    return true;
  }
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf8').toString('base64');
  const device = await ble.connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS });
  await device.discoverAllServicesAndCharacteristics();
  const services = await device.services();
  const svc = services.find((s) => s.uuid.toLowerCase() === AFETNET_SERVICE_UUID);
  if (!svc) throw new Error('Service not found on device');
  const chars = await device.characteristicsForService(svc.uuid);
  const char = chars.find((c) => c.uuid.toLowerCase() === AFETNET_CHAR_MSG_UUID);
  if (!char) throw new Error('Characteristic not found');
  await device.writeCharacteristicWithResponseForService(svc.uuid, char.uuid, base64);
  await device.cancelConnection();
  return true;
}
