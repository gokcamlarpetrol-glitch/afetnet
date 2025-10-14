# 🍎 Apple App Store Review Checklist

## ✅ App Store Gereksinimleri

### 1. **Metadata & Açıklamalar**
- ✅ **App Name:** AfetNet
- ✅ **Bundle ID:** org.afetnet.app
- ✅ **Version:** 1.0.0
- ✅ **Category:** Utilities / Lifestyle
- ✅ **Privacy Policy:** https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
- ✅ **Terms of Service:** https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html
- ✅ **Support Email:** support@afetnet.app

### 2. **Permissions & Privacy (NSUsageDescription)**
- ✅ **Location (When In Use):** "AfetNet, acil durum sinyali gönderirken konumunuzu kurtarma ekiplerine iletmek için konum kullanır."
- ✅ **Location (Always):** "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek için arka planda konum erişimi gerektirir."
- ✅ **Microphone:** "AfetNet, acil durum sesli yönlendirme vermek için mikrofon kullanır."
- ✅ **Camera:** "AfetNet, aile üyeleri eklemek için kamera kullanır."
- ✅ **Motion:** "AfetNet, deprem sarsıntısını algılayarak erken uyarı vermek için hareket sensörlerini kullanır."

### 3. **Background Modes**
- ✅ **bluetooth-central:** BLE mesh network için
- ✅ **bluetooth-peripheral:** BLE beacon için
- ✅ **processing:** Background tasks için
- ✅ **location:** Konum takibi için

### 4. **Encryption Declaration**
- ✅ **ITSAppUsesNonExemptEncryption:** false (Standart HTTPS kullanımı)

### 5. **In-App Purchases**
- ✅ **Monthly Premium:** 49.99 TRY
- ✅ **Yearly Premium:** 499.99 TRY (17% indirim)
- ✅ **Lifetime Premium:** 999.99 TRY (50% indirim)

### 6. **Core Features**
- ✅ Acil durum SOS sinyali
- ✅ Aile konumu takibi
- ✅ Deprem erken uyarı sistemi
- ✅ Offline harita
- ✅ BLE mesh network (internet olmadan iletişim)
- ✅ QR kod ile aile ekleme
- ✅ Sesli yönlendirme
- ✅ Push notifications

### 7. **Technical Requirements**
- ✅ **SDK:** Expo 54.0.0
- ✅ **React Native:** 0.81.4
- ✅ **TypeScript:** Hatasız derleme
- ✅ **Dependencies:** 991 paket, 0 vulnerability
- ✅ **Minimum iOS:** 13.4+

### 8. **App Store Guidelines Compliance**

#### ✅ **2.1 - App Completeness**
- Uygulama tam fonksiyonel
- Tüm özellikler çalışıyor
- Crash yok

#### ✅ **2.3 - Accurate Metadata**
- Açıklamalar doğru
- Screenshots güncel olacak
- Privacy policy mevcut

#### ✅ **3.1.1 - In-App Purchase**
- IAP doğru implement edilmiş
- Restore purchase mevcut
- Fiyatlar açık

#### ✅ **4.0 - Design**
- Modern UI/UX
- iOS design guidelines uyumlu
- Dark mode destekli

#### ✅ **5.1.1 - Data Collection**
- Privacy policy açık
- Kullanıcı izni alınıyor
- Data minimization

## 🚨 Apple Review İçin Önemli Notlar

### Test Account (Gerekirse)
```
Email: test@afetnet.app
Password: [Apple'a gönderilecek]
```

### Demo Video
- Acil durum özelliklerini göster
- Aile takibi nasıl çalışıyor
- BLE mesh network demo
- Offline özellikleri

### Review Notes
```
AfetNet, Türkiye'de deprem ve acil durumlar için geliştirilmiş bir uygulamadır.

ÖNEMLİ ÖZELLİKLER:
1. SOS Butonu: Acil durumlarda konum paylaşımı
2. Aile Takibi: Gerçek zamanlı konum paylaşımı
3. Deprem Uyarısı: Erken uyarı sistemi
4. Offline Harita: İnternet olmadan çalışır
5. BLE Mesh: İnternet olmadan mesajlaşma

PERMISSIONS:
- Location: Acil durum konumu ve aile takibi için
- Camera: QR kod tarama için
- Microphone: Sesli yönlendirme için
- Motion: Deprem algılama için
- Bluetooth: Offline iletişim için

TEST:
1. Ana ekranda SOS butonuna basın
2. Family sekmesinde QR kod ile aile ekleyin
3. Map sekmesinde offline harita görün
```

## 📱 Build Hazırlığı

### Pre-Build Checklist
- ✅ TypeScript hatasız
- ✅ Tüm dependencies yüklü
- ✅ Firebase configured
- ✅ IAP configured
- ✅ Privacy policy links çalışıyor
- ✅ App icons hazır
- ✅ Splash screen hazır

### Build Command
```bash
npx eas build --platform ios --profile production
```

### Submit Command
```bash
npx eas submit --platform ios
```

---
**Durum:** Apple Store'a gönderilmeye hazır ✅
**Son Kontrol:** $(date)

