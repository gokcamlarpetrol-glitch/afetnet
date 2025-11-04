# Firebase Setup Guide - AfetNet

**Tarih:** 4 Kasım 2025  
**Durum:** Tüm Firebase dosyaları hazır

---

## 📋 ADIM 1: FIREBASE CONSOLE SETUP

### 1.1 Firebase Console'a Git
1. https://console.firebase.google.com adresine git
2. `afetnet-4a6b6` projesini seç (veya yeni proje oluştur)

### 1.2 iOS App Ekle
1. Project Settings > General > Your apps
2. iOS app ekle
3. Bundle ID: `com.gokhancamci.afetnetapp`
4. `GoogleService-Info.plist` dosyasını indir
5. Proje root'una kopyala (veya `scripts/firebase_setup.py` kullan)

### 1.3 Android App Ekle
1. Project Settings > General > Your apps
2. Android app ekle
3. Package name: `com.gokhancamci.afetnetapp`
4. `google-services.json` dosyasını indir
5. Proje root'una kopyala (veya `scripts/firebase_setup.py` kullan)

---

## 📋 ADIM 2: FIREBASE SERVİSLERİNİ AKTİF ET

### 2.1 Firestore Database
1. Firebase Console > Firestore Database
2. "Create database" tıkla
3. **Production mode** seç (Security rules ile korunuyor)
4. Location: `europe-west1` (veya en yakın bölge)
5. Database oluştur

### 2.2 Cloud Storage
1. Firebase Console > Storage
2. "Get started" tıkla
3. **Production mode** seç
4. Location: Firestore ile aynı bölgeyi seç
5. Storage oluştur

### 2.3 Cloud Messaging (FCM)
1. Firebase Console > Cloud Messaging
2. iOS için APNs sertifikası ekle (Apple Developer Portal'dan)
3. Android için Server key not al (gerekirse)

---

## 📋 ADIM 3: CONFIG DOSYALARINI GÜNCELLE

### 3.1 Android App ID Güncelle
1. Firebase Console > Project Settings > General
2. Android app'in **App ID**'sini kopyala
3. `src/core/config/firebase.ts` dosyasını aç
4. `YOUR_ANDROID_APP_ID` yerine gerçek App ID'yi yapıştır:
   ```typescript
   android: {
     // ...
     appId: '1:702394557087:android:GERÇEK_APP_ID_BURAYA',
     // ...
   }
   ```

### 3.2 google-services.json Güncelle
1. Firebase Console > Project Settings > General > Your apps > Android
2. `google-services.json` dosyasını indir
3. Proje root'una kopyala (mevcut dosyanın üzerine)
   ```bash
   # Manuel olarak:
   cp ~/Downloads/google-services.json .
   
   # Veya script ile:
   python3 scripts/firebase_setup.py
   ```

### 3.3 GoogleService-Info.plist Güncelle
1. Firebase Console > Project Settings > General > Your apps > iOS
2. `GoogleService-Info.plist` dosyasını indir
3. Proje root'una kopyala (mevcut dosyanın üzerine)
   ```bash
   # Manuel olarak:
   cp ~/Downloads/GoogleService-Info.plist .
   
   # Veya script ile:
   python3 scripts/firebase_setup.py
   ```

---

## 📋 ADIM 4: FIREBASE DEPLOY

### 4.1 Firebase CLI Kurulumu
```bash
npm install -g firebase-tools
firebase login
```

### 4.2 Projeyi Bağla
```bash
firebase use afetnet-4a6b6
```

### 4.3 Deploy
```bash
# Otomatik script ile:
./scripts/firebase_deploy.sh

# Veya manuel:
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 📋 ADIM 5: VERİFİKASYON

### 5.1 Firestore Kontrolü
1. Firebase Console > Firestore Database
2. "Rules" sekmesinde security rules görünmeli
3. "Indexes" sekmesinde index'ler oluşturuluyor olmalı (birkaç dakika)

### 5.2 Storage Kontrolü
1. Firebase Console > Storage
2. "Rules" sekmesinde storage rules görünmeli

### 5.3 App'te Test
1. Uygulamayı çalıştır
2. Device ID oluşturulmalı
3. Firestore'da `devices/{deviceId}` görünmeli

---

## 📁 OLUŞTURULAN DOSYALAR

### Firebase Config
- ✅ `firebase.json` - Firebase proje config
- ✅ `.firebaserc` - Firebase project ID
- ✅ `firestore.rules` - Firestore security rules
- ✅ `firestore.indexes.json` - Firestore indexes
- ✅ `storage.rules` - Storage security rules

### Firebase Services (Kod)
- ✅ `src/lib/firebase.ts` - Firebase app initialization
- ✅ `src/core/config/firebase.ts` - Firebase config
- ✅ `src/core/services/FirebaseService.ts` - Push notifications
- ✅ `src/core/services/FirebaseDataService.ts` - Firestore operations
- ✅ `src/core/services/FirebaseStorageService.ts` - Storage operations
- ✅ `src/core/services/FirebaseAnalyticsService.ts` - Analytics (disabled)
- ✅ `src/core/services/FirebaseCrashlyticsService.ts` - Crashlytics (disabled)

### Scripts
- ✅ `scripts/firebase_setup.py` - Config dosyalarını otomatik kopyala
- ✅ `scripts/firebase_deploy.sh` - Firebase deploy script

---

## 🔒 GÜVENLİK

### Firestore Security Rules
- Device ID bazlı erişim kontrolü
- Family members: Device owner bazlı
- SOS signals: Public read (emergency için)
- Messages: Device ID bazlı
- Default deny: Diğer erişimler reddediliyor

### Storage Security Rules
- Profile images: User bazlı
- SOS attachments: Public read (emergency için)
- Family images: Device owner bazlı
- MBTiles: Public read (offline maps için)
- Default deny: Diğer erişimler reddediliyor

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Android App ID:** `src/core/config/firebase.ts` dosyasında güncellenmeli
2. **Config Dosyaları:** Firebase Console'dan indirilen gerçek dosyalar kullanılmalı
3. **Security Rules:** Production'da test edilmeli
4. **Index'ler:** Oluşturulması birkaç dakika sürebilir
5. **Analytics/Crashlytics:** Şimdilik disabled (Apple review için)

---

## 🎯 SONUÇ

**Hazır Dosyalar:**
- ✅ Firebase config files
- ✅ Security rules
- ✅ Index definitions
- ✅ Service implementations
- ✅ Deploy scripts

**Yapılması Gerekenler:**
1. ⚠️ Firebase Console'dan config dosyalarını indir
2. ⚠️ Android App ID'yi güncelle
3. ⚠️ Firestore ve Storage'ı oluştur
4. ⚠️ Security rules'ları deploy et

**Tüm kod ve dosyalar hazır! Firebase Console'dan config dosyalarını indirip güncelle yeterli.**

---

**Commit:** `67687a2` - Firebase kontrolü tamamlandı

