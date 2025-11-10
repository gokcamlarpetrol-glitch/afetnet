# Firebase Deploy - Hızlı Adımlar

**Durum:** Firebase CLI yüklendi ✅  
**Login:** Manuel yapılması gerekiyor (tarayıcı açılacak)

---

## 🚀 HIZLI DEPLOY (Terminal'de)

### Adım 1: Firebase Login
```bash
firebase login
```
Bu komut tarayıcıyı açacak ve Google hesabınızla giriş yapmanızı isteyecek.

### Adım 2: Project Aktif Et
```bash
firebase use afetnet-4a6b6
```

### Adım 3: Deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 🔄 ALTERNATİF: Firebase Console'dan Manuel Deploy

Eğer Firebase CLI kullanmak istemiyorsanız, Firebase Console'dan manuel olarak güncelleyebilirsiniz:

### 1. Firestore Security Rules
1. https://console.firebase.google.com/project/afetnet-4a6b6/firestore/rules
2. `firestore.rules` dosyasını aç
3. İçeriğini kopyala
4. Firebase Console'daki Rules editörüne yapıştır
5. "Publish" tıkla

### 2. Firestore Indexes
1. https://console.firebase.google.com/project/afetnet-4a6b6/firestore/indexes
2. `firestore.indexes.json` dosyasını aç
3. Her index için manuel olarak ekle:
   - Collection: `devices` (veya ilgili collection)
   - Fields: Index fields'ları ekle
   - "Create Index" tıkla

**Not:** Index'ler otomatik oluşturulabilir (ilk sorgu geldiğinde Firebase Console önerir)

### 3. Storage Security Rules
1. https://console.firebase.google.com/project/afetnet-4a6b6/storage/rules
2. `storage.rules` dosyasını aç
3. İçeriğini kopyala
4. Firebase Console'daki Rules editörüne yapıştır
5. "Publish" tıkla

---

## 📋 DEPLOY EDİLECEK DOSYALAR

1. **firestore.rules** → Firestore Security Rules
2. **firestore.indexes.json** → Firestore Indexes
3. **storage.rules** → Storage Security Rules

---

## ✅ SONUÇ

**Firebase CLI hazır ve yüklü!**

Sadece login yapmanız gerekiyor:
```bash
firebase login
```

Sonra deploy:
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

**Veya Firebase Console'dan manuel olarak güncelleyebilirsiniz (yukarıdaki adımlar).**

---

**Hazır Dosyalar:**
- ✅ `firestore.rules` - Security rules hazır
- ✅ `firestore.indexes.json` - Indexes hazır
- ✅ `storage.rules` - Storage rules hazır
- ✅ `firebase.json` - Firebase config hazır
- ✅ `.firebaserc` - Project ID hazır

**Sadece deploy etmeniz gerekiyor!**

