# Firebase Veri Saklama Durum Raporu

**Tarih:** 4 Kasım 2025  
**Durum:** Firebase hazır, bazı eksikler var

---

## ✅ HAZIR OLANLAR

### 1. **Firestore Collections (Rules ile Korunuyor)**
- ✅ `devices/{deviceId}` - Cihaz ID'leri
- ✅ `devices/{deviceId}/familyMembers/{memberId}` - Aile üyeleri
- ✅ `sos/{sosId}` - SOS sinyalleri
- ✅ `messages/{messageId}` - Mesajlar (BLE mesh backup)

### 2. **Firebase Storage (Rules ile Korunuyor)**
- ✅ `profiles/{userId}/` - Profil resimleri
- ✅ `sos/{sosId}/` - SOS ekleri (fotoğraf, video)
- ✅ `family/{deviceId}/{memberId}/` - Aile üyesi resimleri
- ✅ `maps/{mapId}/` - MBTiles offline haritalar

### 3. **Firebase Services Implementation**
- ✅ `FirebaseDataService` - Device ID ve Family Members için hazır
- ✅ `FirebaseStorageService` - Dosya upload/download hazır
- ✅ Index'ler - Tüm collections için tanımlı

### 4. **Kod Entegrasyonu**
- ✅ Device ID kaydediliyor (`familyStore.ts`)
- ✅ Family Members kaydediliyor (`familyStore.ts`)
- ✅ Real-time sync (`subscribeToFamilyMembers`)

---

## ❌ EKSİKLER

### 1. **Mesajlar Firestore'a Kaydedilmiyor**
- ❌ `BLEMeshService.sendMessage()` - Mesaj gönderiliyor ama Firestore'a kaydedilmiyor
- ❌ `FirebaseDataService.saveMessage()` metodu yok
- ❌ Mesajlar sadece local state'te (meshStore)

### 2. **SOS Sinyalleri Firestore'a Kaydedilmiyor**
- ❌ `SOSService.sendSOSSignal()` - SOS gönderiliyor ama Firestore'a kaydedilmiyor
- ❌ `FirebaseDataService.saveSOS()` metodu yok
- ❌ SOS sadece BLE mesh ile broadcast ediliyor

### 3. **Device ID Otomatik Kayıt**
- ⚠️ Device ID `familyStore.ts` içinde kaydediliyor ama app başlangıcında otomatik kayıt yok
- ⚠️ İlk açılışta device ID Firestore'a kaydedilmeli

---

## 📋 YAPILACAKLAR

1. ✅ `FirebaseDataService.saveMessage()` metodu ekle
2. ✅ `FirebaseDataService.saveSOS()` metodu ekle
3. ✅ `BLEMeshService.sendMessage()` içinde Firestore'a kaydet
4. ✅ `SOSService.sendSOSSignal()` içinde Firestore'a kaydet
5. ✅ App başlangıcında device ID'yi otomatik kaydet

---

## 🔒 GÜVENLİK

- ✅ Firestore Rules: Device ID-based access control aktif
- ✅ Storage Rules: User-based access control aktif
- ⚠️ Production'da ek güvenlik kontrolleri eklenebilir (Firebase Auth)

---

## 📊 VERİ YAPISI

### Devices Collection
```typescript
/devices/{deviceId}
{
  deviceId: string,
  createdAt: string,
  updatedAt: string
}
```

### Family Members Subcollection
```typescript
/devices/{deviceId}/familyMembers/{memberId}
{
  id: string,
  name: string,
  deviceId: string,
  lastSeen: number,
  location?: { lat, lng },
  status?: string,
  updatedAt: string
}
```

### SOS Signals Collection
```typescript
/sos/{sosId}
{
  id: string,
  deviceId: string,
  timestamp: number,
  location: { latitude, longitude, accuracy },
  message: string,
  status: 'active' | 'resolved'
}
```

### Messages Collection
```typescript
/messages/{messageId}
{
  id: string,
  from: string, // deviceId
  to?: string, // deviceId (optional for broadcast)
  content: string,
  type: 'text' | 'sos' | 'status',
  timestamp: number,
  priority: 'low' | 'normal' | 'high' | 'critical'
}
```

---

**Not:** Tüm eksiklerin tamamlanması gerekiyor.
