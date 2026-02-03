import { useEffect, useState } from 'react';
import { EmergencyAlert } from '../types/alerts';
import { fetchEmergencyFeed } from '../services/featureService';

export function useEmergencyFeed() {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchEmergencyFeed();
        if (mounted) {
          setAlerts(result);
        }
      } catch (err) {
        if (mounted) {
          setError('Güncellenemedi');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, 120000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { alerts, loading, error };
}
