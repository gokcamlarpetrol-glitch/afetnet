import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Platform } from 'react-native';
import { useEEWStore } from './store';

export default function CountdownModal() {
  // CRITICAL FIX: Use getState pattern to prevent infinite loops from selectors
  const [active, setActive] = useState<ReturnType<typeof useEEWStore.getState>['active']>(undefined);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    // Poll store state instead of using selector
    const checkStore = () => {
      const currentActive = useEEWStore.getState().active;
      setActive(currentActive); // Always update to latest
    };
    
    checkStore(); // Check immediately
    const interval = setInterval(checkStore, 100);
    return () => clearInterval(interval);
  }, []); // CRITICAL: Empty deps to prevent infinite loop

  useEffect(() => {
    if (!active) { return; }
    setLeft(Math.max(0, Math.floor(Number(active.etaSec) || 0)));
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [active?.eventId]);

  useEffect(() => { if (active && left === 0) { /* could vibrate or focus modal */ } }, [left]);

  const clear = () => useEEWStore.getState().clear();

  return (
    <Modal visible={!!active} animationType="fade" presentationStyle="overFullScreen" onRequestClose={clear}>
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: 'white', fontSize: 22, marginBottom: 8 }}>Erken Deprem Uyarısı</Text>
        <Text style={{ color: '#f87171', fontSize: 64, fontWeight: '600' }}>{left}s</Text>
        <Text style={{ color: 'white', marginTop: 8 }}>{active?.region || '—'}  M{active?.mag ?? '—'}  Kaynak: {active?.source}</Text>
        <Text style={{ color: '#aaaaaa', marginTop: 4, fontSize: 12 }}>Cihaz {Platform.OS}</Text>
      </View>
    </Modal>
  );
}


