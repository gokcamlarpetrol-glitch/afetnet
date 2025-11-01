/**
 * NETWORK STATUS HOOK
 * Monitor online/offline state
 */

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>('unknown');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? false);
      setNetworkType(state.type);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, networkType };
}

