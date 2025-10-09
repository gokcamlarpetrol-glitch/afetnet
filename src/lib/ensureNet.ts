import NetInfo from '@react-native-community/netinfo';

export async function ensureOnline(): Promise<void> {
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    throw new Error('İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.');
  }
  
  if (netInfo.type === 'none' || netInfo.type === 'unknown') {
    throw new Error('Bağlantı türü desteklenmiyor. Lütfen WiFi veya mobil veri kullanın.');
  }
}
