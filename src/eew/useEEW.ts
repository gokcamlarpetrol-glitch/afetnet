// ELITE: Zero static dependencies - lazy load expo-notifications
import { useEffect } from 'react';
import { useEEWStore } from './store';

let NotificationsModule: any = null;
let isNotificationsLoading = false;

async function getNotificationsAsync(): Promise<any> {
  if (NotificationsModule) return NotificationsModule;
  if (isNotificationsLoading) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NotificationsModule;
  }
  
  isNotificationsLoading = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ELITE: Use eval to prevent static analysis
    const moduleName = 'expo-' + 'notifications';
    NotificationsModule = eval(`require('${moduleName}')`);
    return NotificationsModule;
  } catch (error) {
    return null;
  } finally {
    isNotificationsLoading = false;
  }
}

export function useEEWListener() {
  useEffect(() => {
    let subscription: any = null;
    
    const setupListener = async () => {
      try {
        const Notifications = await getNotificationsAsync();
        if (!Notifications || typeof Notifications.addNotificationReceivedListener !== 'function') {
          return;
        }
        
        subscription = Notifications.addNotificationReceivedListener((n: any) => {
          try {
            const data: any = n.request?.content?.data;
            if (data?.type === 'EEW') {
              // CRITICAL FIX: Use getState() instead of selector to prevent infinite loops
              const { setActive } = useEEWStore.getState();
              setActive({
                eventId: String(data.eventId || 'EEW'),
                etaSec: Number(data.etaSec || 0),
                mag: data.magnitude != null ? Number(data.magnitude) : undefined,
                region: data.region,
                issuedAt: Number(data.issuedAt || Date.now()),
                source: String(data.source || 'push'),
              });
            }
          } catch {
            // ignore
          }
        });
      } catch (error) {
        // Silent fail
      }
    };
    
    setupListener();
    
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []); // CRITICAL: Empty deps - no re-renders
}
