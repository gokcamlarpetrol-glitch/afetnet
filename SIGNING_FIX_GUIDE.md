# 🔧 Xcode Signing Hatası Düzeltme Kılavuzu

## ✅ Yapılan Düzeltmeler

### 1. Entitlements Sadeleştirildi
- Gereksiz entitlements kaldırıldı
- Sadece geliştirme için gerekli olanlar bırakıldı:
  - `aps-environment`: development (production build için Apple Developer Portal'da değiştirilmeli)
  - `com.apple.developer.push-notifications`: true
  - `com.apple.developer.in-app-payments`: merchant ID

### 2. Background Modes
- UIBackgroundModes Info.plist'te tanımlı (bu yeterli)
- Bluetooth ve Location background modes aktif

### 3. Prebuild Yeniden Çalıştırıldı
- iOS native klasörleri temizlenip yeniden oluşturuldu
- CocoaPods yeniden yüklendi

## 📱 Xcode'da Yapılacaklar

### Adım 1: Xcode'u Açın
```bash
open ios/AfetNet.xcworkspace
```

### Adım 2: Signing & Capabilities'i Düzeltin

1. **Sol panelden "AfetNet" projesini seçin**
2. **"AfetNet" target'ını seçin**
3. **"Signing & Capabilities" sekmesine gidin**

### Adım 3: Otomatik Signing'i Sıfırlayın

1. **"Automatically manage signing" kutusunu KAPATIN**
2. **Tekrar AÇIN** (bu Xcode'un provisioning profile'ı yeniden oluşturmasını sağlar)
3. **Team'i seçin**: "Gökhan ÇAMCI"

### Adım 4: Capabilities Ekleyin (Manuel)

Eğer otomatik signing hala başarısız olursa, capabilities'leri manuel ekleyin:

1. **"+ Capability" butonuna tıklayın**
2. **Şunları ekleyin:**
   - ✅ Background Modes
     - Location updates
     - Background fetch
     - Remote notifications
     - Uses Bluetooth LE accessories
   - ✅ Push Notifications
   - ✅ In-App Purchase (zaten var)

### Adım 5: Background Modes'i Yapılandırın

Background Modes capability'sini ekledikten sonra:
- ✅ Location updates
- ✅ Background fetch
- ✅ Remote notifications
- ✅ Uses Bluetooth LE accessories

### Adım 6: Build ve Run

1. **Product > Clean Build Folder** (Cmd+Shift+K)
2. **Telefonunuzu seçin** (device selector'da)
3. **Product > Build** (Cmd+B)
4. **Product > Run** (Cmd+R)

## ⚠️ Önemli Notlar

### Development vs Production

- **Development Build**: Şu anki entitlements yeterli
- **Production Build (App Store)**: 
  - Apple Developer Portal'da capabilities'leri aktif etmeniz gerekiyor
  - `aps-environment`'ı `production` yapmanız gerekiyor
  - Tüm gerekli capabilities Apple Developer Portal'da aktif olmalı

### Apple Developer Portal'da Yapılacaklar (Production için)

1. **developer.apple.com** → Certificates, Identifiers & Profiles
2. **Identifiers** → `com.gokhancamci.afetnetapp` seçin
3. **Capabilities** bölümünden şunları aktif edin:
   - Push Notifications
   - In-App Purchase
   - Background Modes (Location, Background fetch, Remote notifications)
   - Bluetooth (eğer gerekliyse)

### Location Always İzni

`location.always` entitlement'ı App Store review'da sorun çıkarabilir. 
- Şimdilik sadece `when-in-use` kullanın
- Production'a geçmeden önce Apple'ın Location Always kullanımı için gereksinimlerini kontrol edin

## 🔍 Sorun Giderme

### Hala Hata Alıyorsanız:

1. **Xcode'u kapatın**
2. **DerivedData'yı temizleyin:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```
3. **iOS klasörünü temizleyin:**
   ```bash
   cd ios && rm -rf Pods Podfile.lock && pod install
   ```
4. **Xcode'u tekrar açın ve build edin**

### "Provisioning profile doesn't include entitlements" Hatası

Bu hata, Apple Developer Portal'da capabilities'lerin aktif olmadığını gösterir.

**Çözüm:**
1. Apple Developer Portal'da capabilities'leri aktif edin
2. Veya development build için capabilities'leri kaldırın (şu an yapıldı)

## ✅ Durum

- ✅ Entitlements sadeleştirildi
- ✅ Development build için hazır
- ✅ Production için Apple Developer Portal ayarları gerekli
- ✅ Build hatası çözülmeli
