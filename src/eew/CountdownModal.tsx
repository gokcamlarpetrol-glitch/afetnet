import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Platform } from 'react-native';
import { useEEWStore } from './store';

export default function CountdownModal() {
  const active = useEEWStore((s) => s.active);
  const clear = useEEWStore((s) => s.clear);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!active) { return; }
    setLeft(Math.max(0, Math.floor(Number(active.etaSec) || 0)));
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [active?.eventId]);

  useEffect(() => { if (active && left === 0) { /* could vibrate or focus modal */ } }, [left]);

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


