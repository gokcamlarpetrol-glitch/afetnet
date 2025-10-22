import { PermissionsAndroid, Platform } from 'react-native';

export async function ensureBlePermissions() {
  if (Platform.OS !== 'android') return;
  const sdkInt = parseInt(String((globalThis as any).RNDeviceInfoSDK_INT ?? 31), 10);
  // Android 12+ (SDK 31): BLUETOOTH_SCAN + BLUETOOTH_CONNECT
  const needsScan = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any;
  const needsConnect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any;
  const results: Record<string, string> = {};
  if (needsScan) {
    results.scan = await PermissionsAndroid.request(needsScan, {
      title: 'Bluetooth tarama izni',
      message: 'Yakın cihazları görebilmek için Bluetooth tarama izni gerekir.',
      buttonPositive: 'İzin ver',
    });
  }
  if (needsConnect) {
    results.connect = await PermissionsAndroid.request(needsConnect, {
      title: 'Bluetooth bağlanma izni',
      message: 'Yakın cihazlarla bağlantı kurmak için izin gerekir.',
      buttonPositive: 'İzin ver',
    });
  }
  // Android 11 ve öncesi: konum izni gerekebilir (bazı üreticiler)
  if (sdkInt < 31) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  }
}
