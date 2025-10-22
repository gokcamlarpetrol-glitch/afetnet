import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getBattSeries } from '../telemetry/battery';
import * as RStore from '../relay/store';
import { getHealth } from '../diagnostics/health';

export async function exportAfetPackage(){
  const health = await getHealth();
  await RStore.load();
  const msgs = RStore.getAll();
  const data = {
    generatedAt: new Date().toISOString(),
    app: Constants?.expoConfig?.name || 'AfetNet',
    build: Constants?.nativeBuildVersion ?? Constants?.expoConfig?.version ?? null,
    device: { model: Device.modelName, os: `${Device.osName} ${Device.osVersion}` },
    health,
    batterySeries: getBattSeries(),
    relayMessages: msgs.slice(-100),
  };
  const path = '/tmp/' + `afet_pkg_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2), { encoding: 'utf8' });
  const can = await Sharing.isAvailableAsync();
  if (!can) {return { path, shared: false };}
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Afet Paketi' });
  return { path, shared: true };
}
