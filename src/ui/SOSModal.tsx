import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, Vibration, View } from 'react-native';
import { logger } from '../utils/productionLogger';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { z } from "zod";

// const schema = z.object({
//   note: z.string().max(280).optional(),
//   people: z.coerce.number().int().min(1).max(50).default(1),
//   priority: z.enum(["low","med","high"]).default("med"),
// });

// export type SOSValues = z.infer<typeof schema>;

// Temporary types for Expo Go compatibility
export type SOSValues = {
  note?: string;
  people: number;
  priority: 'low' | 'med' | 'high';
};

export default function SOSModal({
  visible, onClose, onSubmit,
}: { visible: boolean; onClose: ()=>void;  
onSubmit: (v:SOSValues)=>void }) {
  const [note, setNote] = useState('');
  const [people, setPeople] = useState('1');
  const [priority, setPriority] = useState<'low' | 'med' | 'high'>('high');
  const [location, setLocation] = useState<{lat: number, lon: number, accuracy: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Get location when modal opens
  useEffect(() => {
    if (visible) {
      getCurrentLocation();
      // Start countdown for emergency situations
      startEmergencyCountdown();
    } else {
      setCountdown(0);
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'SOS göndermek için konum izni gereklidir!');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
      });
      
      setLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy || 10,
      });
    } catch (error) {
      logger.error('Location error:', error);
      Alert.alert('Konum Hatası', 'Konum alınamadı. Manuel konum girişi yapın.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const startEmergencyCountdown = () => {
    setCountdown(30); // 30 seconds countdown
    const timer = (globalThis as any).setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          (globalThis as any).clearInterval(timer);
          // Auto-submit emergency SOS if no action taken
          autoSubmitEmergency();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const autoSubmitEmergency = () => {
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]); // Emergency vibration pattern
    const data: SOSValues = {
      note: 'OTOMATİK ACİL DURUM SOS - Kullanıcı yanıt vermedi',
      people: parseInt(people) || 1,
      priority: 'high',
    };
    onSubmit(data);
    resetForm();
  };

  const resetForm = () => {
    setNote('');
    setPeople('1');
    setPriority('high');
    setLocation(null);
    setCountdown(0);
  };

  function submit(){
    // Critical validation
    if (!location) {
      Alert.alert(
        'Konum Gerekli',
        'SOS göndermek için konum bilgisi zorunludur. Konum alınmaya çalışılıyor...',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Konum Al', onPress: getCurrentLocation },
        ],
      );
      return;
    }

    // Validate people count
    const peopleCount = parseInt(people);
    if (isNaN(peopleCount) || peopleCount < 1 || peopleCount > 100) {
      Alert.alert('Hata', 'Geçerli bir kişi sayısı girin (1-100)');
      return;
    }

    // Emergency vibration pattern
    Vibration.vibrate([0, 500, 200, 500]);

    const data: SOSValues = {
      note: note.trim() || undefined,
      people: peopleCount,
      priority,
    };
    
    // Critical: Show confirmation for high priority SOS
    if (priority === 'high') {
      Alert.alert(
        'ACİL DURUM SOS',
        'Bu bir acil durum SOS mesajıdır. Kurtarma ekipleri bilgilendirilecektir. Gönderilsin mi?',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'EVET, GÖNDER', 
            style: 'destructive',
            onPress: () => {
              onSubmit(data);
              resetForm();
              onClose();
            },
          },
        ],
      );
    } else {
      onSubmit(data);
      resetForm();
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex:1, backgroundColor:'#0009', padding:16, justifyContent:'center' }}>
        <View style={{ backgroundColor:'#0f172a', borderRadius:16, padding:16, borderWidth: 2, borderColor: priority === 'high' ? '#ef4444' : '#1f2937' }}>
          {/* Emergency Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="warning" size={24} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={{ color:'#ef4444', fontWeight:'800', fontSize:20, flex: 1 }}>
              {priority === 'high' ? 'ACİL DURUM SOS' : 'Yardım Talebi'}
            </Text>
            {countdown > 0 && (
              <View style={{ backgroundColor: '#7d1a1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#ff7f7f', fontWeight: '700', fontSize: 12 }}>
                  {countdown}s
                </Text>
              </View>
            )}
          </View>

          {/* Location Status */}
          <View style={{ marginBottom: 16, padding: 12, backgroundColor: location ? '#0e3d28' : '#7d1a1a', borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={isGettingLocation ? 'location' : location ? 'checkmark-circle' : 'alert-circle'} 
                size={16} 
                color={isGettingLocation ? '#f59e0b' : location ? '#38d39f' : '#ef476f'} 
                style={{ marginRight: 8 }}
              />
              <Text style={{ color: isGettingLocation ? '#f59e0b' : location ? '#38d39f' : '#ef476f', fontWeight: '600', fontSize: 12 }}>
                {isGettingLocation ? 'Konum alınıyor...' : location ? 'Konum alındı' : 'Konum gerekli'}
              </Text>
            </View>
            {location && (
              <Text style={{ color: '#8da0cc', fontSize: 10, marginTop: 4 }}>
                Enlem: {location.lat.toFixed(6)}, Boylam: {location.lon.toFixed(6)} (±{location.accuracy}m)
              </Text>
            )}
          </View>

          <Text style={{ color:'#94a3b8', marginBottom: 8 }}>Kişi Sayısı</Text>
          <TextInput
            keyboardType="number-pad"
            value={people}
            onChangeText={setPeople}
            style={{ backgroundColor:'#111827', color:'white', padding:12, borderRadius:10, marginBottom:16, borderWidth: 1, borderColor: '#1f2937' }}
            accessibilityLabel="Kişi sayısı"
            placeholder="1"
            placeholderTextColor="#6b7280"
          />
          
          <Text style={{ color:'#94a3b8', marginBottom: 8 }}>Öncelik</Text>
          <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
            {[
              { key: 'low', label: 'Düşük', color: '#10b981' },
              { key: 'med', label: 'Orta', color: '#f59e0b' },
              { key: 'high', label: 'Yüksek', color: '#ef4444' },
            ].map((p)=>(
              <Pressable 
                key={p.key} 
                onPress={() => setPriority(p.key as 'low' | 'med' | 'high')}
                style={{
                  flex: 1,
                  paddingVertical:12,
                  paddingHorizontal:16,
                  borderRadius:10,
                  backgroundColor: priority === p.key ? p.color : '#1f2937',
                  borderWidth: 2,
                  borderColor: priority === p.key ? p.color : '#374151',
                }}>
                <Text style={{ color:'white', fontWeight:'700', textAlign: 'center', fontSize: 12 }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          
          <Text style={{ color:'#94a3b8', marginBottom: 8 }}>Not (opsiyonel)</Text>
          <TextInput
            placeholder="Durumunuzu kısaca açıklayın..."
            placeholderTextColor="#6b7280"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={280}
            style={{
              backgroundColor:'#111827', 
              color:'white', 
              padding:12, 
              borderRadius:10, 
              height:80, 
              marginBottom:16,
              borderWidth: 1,
              borderColor: '#1f2937',
              textAlignVertical: 'top',
            }}
            accessibilityLabel="Not alanı"
          />
          
          {/* Emergency Warning */}
          {priority === 'high' && (
            <View style={{ backgroundColor: '#7d1a1a', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={16} color="#ff7f7f" style={{ marginRight: 8 }} />
                <Text style={{ color: '#ff7f7f', fontWeight: '600', fontSize: 12, flex: 1 }}>
                  YÜKSEK ÖNCELİK: Bu mesaj acil durum ekiplerine iletilecektir
                </Text>
              </View>
            </View>
          )}

          <View style={{ flexDirection:'row', gap:12, justifyContent:'flex-end' }}>
            <Pressable 
              onPress={onClose} 
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#374151',
              }}>
              <Text style={{ color:'#94a3b8', fontWeight:'700' }}>İptal</Text>
            </Pressable>
            <Pressable 
              onPress={submit} 
              style={{
                backgroundColor: priority === 'high' ? '#dc2626' : '#ef4444', 
                paddingHorizontal: 20,
                paddingVertical: 12, 
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}>
              <Ionicons name="send" size={16} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color:'white', fontWeight:'800' }}>
                {priority === 'high' ? 'ACİL GÖNDER' : 'Gönder'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
