# Xcode Signing Hatası Çözüm Kılavuzu

## 🔴 Sorun
Provisioning profile gerekli entitlements'ları içermiyor.

## ✅ Çözüm Adımları

### 1. Apple Developer Portal Kontrolü (KRİTİK)

https://developer.apple.com/account/resources/identifiers/list adresine gidin:

1. **Certificates, Identifiers & Profiles** → **Identifiers**
2. `com.gokhancamci.afetnetapp` App ID'yi bulun
3. **Edit** butonuna tıklayın
4. **Enabled Capabilities** bölümünde şunları kontrol edin:
   - ✅ **Push Notifications** (APN key oluşturulmuş olmalı)
   - ✅ **Background Modes** (fetch, processing, remote-notification, location updates)
   - ✅ **Bluetooth LE**
   - ✅ **Location Services** (Always, When In Use, Background)
   - ✅ **In-App Purchase**
   - ✅ **Associated Domains**
   - ✅ **Apple Pay** (merchant.com.gokhancamci.afetnetapp)
5. **Save** edin

### 2. Xcode'da Capability Ekleme

Xcode'da **Signing & Capabilities** sekmesinde:

1. **"+ Capability"** butonuna tıklayın
2. Şu capability'leri **sırayla ekleyin** (zaten ekliyse atlayın):
   - **Push Notifications**
   - **Background Modes** → içinde şunları işaretleyin:
     - Remote notifications
     - Background fetch
     - Background processing
     - Location updates
   - **Bluetooth LE**
   - **Location Updates** (Location Services)
   - **In-App Purchase**
   - **Associated Domains** (zaten var: applinks:afetnet.app)

### 3. Xcode Temizleme

```bash
# Terminal'de çalıştırın:
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/MobileDevice/"Provisioning Profiles"/*.mobileprovision
```

Sonra Xcode'u kapatıp tekrar açın.

### 4. Xcode'da "Try Again"

1. **Signing & Capabilities** sekmesinde
2. **"Try Again"** butonuna tıklayın
3. Xcode otomatik olarak Developer Portal'dan yeni profile indirecek

### 5. Hala Çözülmezse

**Manuel Profile İndirme:**

1. Xcode → **Preferences** → **Accounts**
2. Apple ID'nizi seçin → **Download Manual Profiles** butonuna tıklayın
3. Tekrar "Try Again" yapın

---

## ⚠️ Önemli Not

**SystemCapabilities** eklendi, ama eğer Developer Portal'da App ID capability'leri aktif değilse, Xcode otomatik signing yapamaz. **ÖNCE Developer Portal'da capability'leri aktif etmelisiniz!**

