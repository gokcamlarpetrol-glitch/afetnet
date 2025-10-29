/*
  Native alarm wrapper
  - Tries to use @notifee/react-native and @react-native-firebase/messaging if present
  - If missing (Expo managed), all functions are safe no-ops
*/

type NFModule = any; // notifee
type MSGModule = any; // @react-native-firebase/messaging

function safeRequire(path: string): any | null {
  try {
    // Avoid bundler import; use global require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = (globalThis as any).require?.(path);
    return req || null;
  } catch { return null; }
}

export async function ensureNativeAlarmChannel(): Promise<void> {
  const notifee: NFModule = safeRequire('@notifee/react-native');
  if (!notifee) { return; }
  try {
    await notifee.createChannel({ id: 'eew-alerts', name: 'Deprem Erken Uyarı', importance: 5, sound: 'default', vibration: true });
  } catch { /* ignore */ }
}

export function initBackgroundMessaging(): void {
  const messaging: MSGModule = safeRequire('@react-native-firebase/messaging');
  const notifee: NFModule = safeRequire('@notifee/react-native');
  if (!messaging || !notifee) { return; }
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      const d = remoteMessage?.data || {};
      if (d?.type === 'EEW') {
        try {
          await ensureNativeAlarmChannel();
          await notifee.displayNotification({
            title: 'Erken Deprem Uyarısı',
            body: `${d.region || 'Bölge'} • M${d.magnitude || '—'} | ${d.etaSec || 0}s`,
            android: { channelId: 'eew-alerts', fullScreenAction: { id: 'eew-fullscreen' } },
            ios: { sound: 'default', interruptionLevel: 'timeSensitive' },
            data: d,
          });
        } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }
}


