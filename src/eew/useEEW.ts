import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useEEWStore } from './store';

export function useEEWListener() {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
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
    return () => sub.remove();
  }, []); // CRITICAL: Empty deps - no re-renders
}


