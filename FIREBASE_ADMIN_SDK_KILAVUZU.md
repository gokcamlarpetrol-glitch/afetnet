# 🔥 FIREBASE ADMIN SDK KURULUM KILAVUZU

## 📱 ŞU ANDA NE YAPIYORSUN?

Firebase Console'da "Service accounts" sekmesindesin. Firebase Admin SDK için Node.js seçili.

---

## ✅ DOĞRU SEÇİM!

**Node.js** seçili kalmalı çünkü:
- Backend'imiz Node.js/TypeScript ile yazıldı
- Express.js server kullanıyoruz
- Firebase Admin SDK Node.js için

---

## 🎯 ŞİMDİ NE YAPACAKSIN?

1. **"Generate new private key"** butonuna tıkla
2. JSON dosyası indirilecek (serviceAccountKey.json)
3. Dosyayı güvenli bir yerde sakla
4. JSON içeriğini bana gönder, backend .env'e ekleyeyim

---

## 📁 İNDİRİLECEK DOSYA

```
serviceAccountKey.json
- Firebase Admin SDK credentials
- Backend için gerekli
- Private key içerir (güvenli sakla!)
```

---

## 🔒 GÜVENLİK NOTU

- Bu dosya **çok önemli**!
- Private key içerir
- GitHub'a yükleme!
- Sadece backend .env'e ekleyeceğiz

---

## 🚀 SONRAKI ADIMLAR

JSON dosyasını indirdikten sonra:

1. **JSON içeriğini bana gönder**
2. **Backend .env'e ekleyeyim:**
   ```bash
   FIREBASE_PROJECT_ID=afetnet-c1ca7
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@afetnet-c1ca7.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. **Backend Firebase Admin SDK aktif olacak!**

---

## 📊 SONUÇ

```
✅ Firebase Client SDK (iOS/Android) - TAMAMLANDI
🔄 Firebase Admin SDK (Backend) - İNDİRİLİYOR
```

---

# 🎯 ŞİMDİ "GENERATE NEW PRIVATE KEY" TIKLA!

**Node.js seçili kalmalı, sadece butona tıkla!**
