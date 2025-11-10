# Firebase Deploy - Manuel Adımlar (Firebase Console)

**Durum:** Firebase CLI login sorunu var, Firebase Console'dan manuel deploy yapılabilir

---

## 🔄 FIREBASE CONSOLE'DAN MANUEL DEPLOY

Firebase CLI login sorunu varsa, Firebase Console'dan manuel olarak güncelleyebilirsiniz:

---

### 1. FIRESTORE SECURITY RULES

**Adımlar:**
1. https://console.firebase.google.com/project/afetnet-4a6b6/firestore/rules adresine git
2. `firestore.rules` dosyasını aç (proje root'unda)
3. Dosyanın tamamını kopyala (satır 1'den son satıra kadar)
4. Firebase Console'daki Rules editörüne yapıştır
5. "Publish" butonuna tıkla

**Dosya:** `firestore.rules`

---

### 2. FIRESTORE INDEXES

**Adımlar:**
1. https://console.firebase.google.com/project/afetnet-4a6b6/firestore/indexes adresine git
2. `firestore.indexes.json` dosyasını aç
3. Her index için:
   - "Add Index" tıkla
   - Collection: `devices` (veya ilgili collection)
   - Fields: Index fields'ları ekle (ör: deviceId Ascending, updatedAt Descending)
   - "Create Index" tıkla

**Not:** Index'ler otomatik oluşturulabilir - ilk sorgu geldiğinde Firebase Console önerir.

**Dosya:** `firestore.indexes.json`

**Index'ler:**
- `devices` collection: deviceId + updatedAt
- `familyMembers` subcollection: deviceId + lastSeen
- `sos` collection: timestamp + location
- `messages` collection: from + timestamp
- `messages` collection: to + timestamp

---

### 3. STORAGE SECURITY RULES

**Adımlar:**
1. https://console.firebase.google.com/project/afetnet-4a6b6/storage/rules adresine git
2. `storage.rules` dosyasını aç (proje root'unda)
3. Dosyanın tamamını kopyala (satır 1'den son satıra kadar)
4. Firebase Console'daki Rules editörüne yapıştır
5. "Publish" butonuna tıkla

**Dosya:** `storage.rules`

---

## 📋 DOSYA YERLERİ

Tüm dosyalar proje root'unda:
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore indexes
- `storage.rules` - Storage security rules

---

## ✅ SONUÇ

Firebase Console'dan manuel olarak güncelleyebilirsiniz. Tüm dosyalar hazır ve proje root'unda.

**Alternatif:** Firebase CLI login sorunu çözülürse:
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

