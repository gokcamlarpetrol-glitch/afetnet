# 🔑 APNs KEY SETUP REHBERİ

## KRİTİK: Push Notifications için APNs Key Setup

### 1. Apple Developer Portal'da APNs Key Oluştur

1. **Apple Developer Portal'a git:**
   ```
   https://developer.apple.com/account/resources/authkeys/list
   ```

2. **Yeni Key Oluştur:**
   ```
   [+] Create a key
   Key Name: AfetNet1 Push Notifications
   ✅ Apple Push Notifications service (APNs)
   Continue > Register
   ```

3. **Key Bilgilerini Kaydet:**
   ```
   Key ID: [10 karakterlik ID] ← ÖNEMLİ!
   Team ID: 3H4SWQ8VJL ← ÖNEMLİ!
   .p8 dosyasını indir ← ÖNEMLİ!
   ```

### 2. Firebase Console'da APNs Key Yükle

1. **Firebase Console'a git:**
   ```
   https://console.firebase.google.com/project/[PROJECT_ID]/settings/cloudmessaging
   ```

2. **iOS App'i Seç:**
   ```
   Bundle ID: org.afetnet1.app
   ```

3. **APNs Authentication Key Yükle:**
   ```
   APNs Authentication Key:
   ├─ Key ID: [Apple Developer'dan aldığın 10 karakter]
   ├─ Team ID: 3H4SWQ8VJL
   └─ .p8 file: [Apple Developer'dan indirdiğin dosya]
   
   Upload
   ```

### 3. Test Push Notification

```bash
# Test komutu (opsiyonel)
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=[FIREBASE_SERVER_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "[DEVICE_TOKEN]",
    "notification": {
      "title": "AfetNet1 Test",
      "body": "Push notification çalışıyor!"
    }
  }'
```

## ⚠️ ÖNEMLİ NOTLAR

- **APNs Key olmadan push notifications çalışmaz!**
- **Key ID ve Team ID doğru olmalı**
- **.p8 dosyası güvenli saklanmalı**
- **Firebase Console'da doğru bundle ID seçilmeli**

## ✅ DOĞRULAMA

Push notification test etmek için:
1. Uygulamayı cihaza yükle
2. Firebase Console > Cloud Messaging > Send test message
3. Device token'ı al ve test gönder
4. Notification geldiğini kontrol et

---

**SONRAKİ ADIM:** APNs Key'i Firebase'e yükle ve Archive et! 🚀
