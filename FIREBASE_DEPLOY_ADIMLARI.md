# Firebase Deploy Adımları

**Tarih:** 4 Kasım 2025  
**Durum:** Firebase CLI yüklendi, login gerekli

---

## 🔐 ADIM 1: Firebase Login

Firebase CLI'ye giriş yapmanız gerekiyor. Bu interaktif bir işlem ve tarayıcı açacak:

```bash
firebase login
```

Bu komut:
1. Tarayıcıyı açacak
2. Google hesabınızla giriş yapmanızı isteyecek
3. Firebase Console'a erişim izni verecek

---

## 📋 ADIM 2: Project Aktif Et

```bash
firebase use afetnet-4a6b6
```

---

## 🚀 ADIM 3: Deploy

```bash
# Tüm Firebase yapılandırmalarını deploy et
firebase deploy --only firestore:rules,firestore:indexes,storage

# Veya script ile:
./scripts/firebase_deploy.sh
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Mevcut Database Korunur:**
   - Security rules deploy edildiğinde mevcut rules'lar değişir
   - Ama mevcut veriler korunur
   - Sadece erişim kuralları güncellenir

2. **Indexes Deploy:**
   - Index'ler oluşturulurken database erişilebilir kalır
   - Index oluşturma birkaç dakika sürebilir
   - Firebase Console'da "Indexes" sekmesinden durumu takip edebilirsiniz

3. **Storage Rules:**
   - Storage rules deploy edildiğinde mevcut dosyalar korunur
   - Sadece yeni erişim kuralları aktif olur

---

## 🔄 ALTERNATİF: Manuel Deploy

Eğer Firebase CLI kullanmak istemiyorsanız:

1. **Firebase Console'a Git:**
   - https://console.firebase.google.com
   - Project: `afetnet-4a6b6`

2. **Firestore Rules:**
   - Firestore Database > Rules
   - `firestore.rules` dosyasının içeriğini kopyala-yapıştır
   - Publish

3. **Firestore Indexes:**
   - Firestore Database > Indexes
   - `firestore.indexes.json` dosyasındaki index'leri manuel ekle
   - Veya Firebase Console otomatik oluşturur (ilk sorgu geldiğinde)

4. **Storage Rules:**
   - Storage > Rules
   - `storage.rules` dosyasının içeriğini kopyala-yapıştır
   - Publish

---

## ✅ SONUÇ

Firebase CLI yüklendi ve hazır. Sadece login yapmanız gerekiyor:

```bash
firebase login
firebase use afetnet-4a6b6
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Veya manuel olarak Firebase Console'dan güncelleyebilirsiniz.

---

**Commit:** `8f8d03a` - Firebase mevcut durum açıklaması

