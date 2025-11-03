import { ble } from '../ble/manager';

export async function restartBleIfNeeded() {
  try {
    const state = await ble.state();
    if (state !== 'PoweredOn') {
      const fn = (globalThis as any).__AFN_BLE_RESTART__;
      if (typeof fn === 'function') {
        await fn();
      }
    }
  } catch {
    // Ignore BLE restart errors
  }
}
