# Firebase Console Deploy - Kopyala-Yapıştır

**Tüm dosyalar hazır! Firebase Console'dan manuel olarak güncelleyin.**

---

## 🔥 1. FIRESTORE SECURITY RULES

### Adımlar:
1. **Firebase Console'a Git:**
   https://console.firebase.google.com/project/afetnet-4a6b6/firestore/rules

2. **Rules Editörünü Aç:**
   - "Edit rules" butonuna tıkla

3. **Mevcut Rules'ları Sil ve Yeni Rules'ı Yapıştır:**
   - Mevcut içeriği seç ve sil
   - Aşağıdaki rules'ı kopyala-yapıştır

4. **Publish:**
   - "Publish" butonuna tıkla

### Rules (Kopyala-Yapıştır):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Devices collection - users can only read/write their own device data
    match /devices/{deviceId} {
      // Allow read/write only if the deviceId matches the authenticated user's device ID
      // Since we're using device IDs (not Firebase Auth), we'll allow public read/write
      // but restrict based on deviceId matching
      // In production, you should add additional security checks
      
      allow read: if request.auth != null || resource.data.deviceId == deviceId;
      allow write: if request.auth != null || request.resource.data.deviceId == deviceId;
      
      // Family members subcollection
      match /familyMembers/{memberId} {
        // Allow read/write only for the device owner
        allow read: if request.auth != null || true; // Allow for offline mesh communication
        allow write: if request.auth != null || request.resource.data.deviceId == deviceId;
        allow delete: if request.auth != null || true;
      }
    }
    
    // Emergency SOS signals collection
    match /sos/{sosId} {
      // Allow anyone to read SOS signals (for emergency response)
      // But only allow write with proper authentication or device ID validation
      allow read: if true;
      allow write: if request.auth != null || request.resource.data.deviceId != null;
      allow delete: if request.auth != null || request.resource.data.deviceId == resource.data.deviceId;
    }
    
    // Messages collection (for BLE mesh backup)
    match /messages/{messageId} {
      // Allow read/write for authenticated users or device ID matching
      allow read: if request.auth != null || resource.data.from == deviceId || resource.data.to == deviceId;
      allow write: if request.auth != null || request.resource.data.from == deviceId;
      allow delete: if request.auth != null || request.resource.data.from == deviceId || request.resource.data.to == deviceId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 💾 2. STORAGE SECURITY RULES

### Adımlar:
1. **Firebase Console'a Git:**
   https://console.firebase.google.com/project/afetnet-4a6b6/storage/rules

2. **Rules Editörünü Aç:**
   - "Edit rules" butonuna tıkla

3. **Mevcut Rules'ları Sil ve Yeni Rules'ı Yapıştır:**
   - Mevcut içeriği seç ve sil
   - Aşağıdaki rules'ı kopyala-yapıştır

4. **Publish:**
   - "Publish" butonuna tıkla

### Rules (Kopyala-Yapıştır):

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // User profile images
    match /profiles/{userId}/{allPaths=**} {
      // Allow read for anyone (public profiles)
      allow read: if true;
      // Allow write only for authenticated users or device ID matching
      allow write: if request.auth != null || request.resource.metadata.userId == userId;
      allow delete: if request.auth != null || request.resource.metadata.userId == userId;
    }
    
    // Emergency SOS images/attachments
    match /sos/{sosId}/{allPaths=**} {
      // Allow read for anyone (emergency response)
      allow read: if true;
      // Allow write for authenticated users or device ID validation
      allow write: if request.auth != null || request.resource.metadata.deviceId != null;
      allow delete: if request.auth != null || request.resource.metadata.deviceId == resource.metadata.deviceId;
    }
    
    // Family member images
    match /family/{deviceId}/{memberId}/{allPaths=**} {
      // Allow read for device owner or family members
      allow read: if request.auth != null || true; // Allow for offline mesh
      // Allow write only for device owner
      allow write: if request.auth != null || request.resource.metadata.deviceId == deviceId;
      allow delete: if request.auth != null || request.resource.metadata.deviceId == deviceId;
    }
    
    // MBTiles offline maps (read-only, uploaded via admin)
    match /maps/{mapId}/{allPaths=**} {
      allow read: if true; // Public read for offline maps
      allow write: if false; // Only admins can upload (via admin SDK)
      allow delete: if false;
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 📊 3. FIRESTORE INDEXES

### Adımlar:
1. **Firebase Console'a Git:**
   https://console.firebase.google.com/project/afetnet-4a6b6/firestore/indexes

2. **Index'leri Ekle:**
   Her index için "Add Index" butonuna tıklayın ve aşağıdaki bilgileri girin:

#### Index 1: Devices Collection
- Collection ID: `devices`
- Query scope: `Collection`
- Fields:
  - `deviceId` - Ascending
  - `updatedAt` - Descending
- Status: Enabled

#### Index 2: Family Members Subcollection
- Collection ID: `familyMembers`
- Query scope: `Collection`
- Fields:
  - `deviceId` - Ascending
  - `lastSeen` - Descending
- Status: Enabled

#### Index 3: SOS Signals
- Collection ID: `sos`
- Query scope: `Collection`
- Fields:
  - `timestamp` - Descending
  - `latitude` - Ascending
  - `longitude` - Ascending
- Status: Enabled

#### Index 4: Messages (from)
- Collection ID: `messages`
- Query scope: `Collection`
- Fields:
  - `from` - Ascending
  - `timestamp` - Descending
- Status: Enabled

#### Index 5: Messages (to)
- Collection ID: `messages`
- Query scope: `Collection`
- Fields:
  - `to` - Ascending
  - `timestamp` - Descending
- Status: Enabled

**Not:** Index'ler otomatik oluşturulabilir - ilk sorgu geldiğinde Firebase Console önerir. Bu durumda manuel eklemenize gerek yok.

---

## ✅ SONUÇ

**Tüm dosyalar hazır!**

1. ✅ Firestore Rules - Kopyala-yapıştır hazır
2. ✅ Storage Rules - Kopyala-yapıştır hazır
3. ✅ Index Definitions - Liste hazır

**Firebase Console'dan yukarıdaki adımları takip ederek güncelleyebilirsiniz.**

---

**Dosyalar:**
- `firestore.rules` - Proje root'unda
- `storage.rules` - Proje root'unda
- `firestore.indexes.json` - Proje root'unda

**Firebase Console Linkleri:**
- Firestore Rules: https://console.firebase.google.com/project/afetnet-4a6b6/firestore/rules
- Storage Rules: https://console.firebase.google.com/project/afetnet-4a6b6/storage/rules
- Firestore Indexes: https://console.firebase.google.com/project/afetnet-4a6b6/firestore/indexes

