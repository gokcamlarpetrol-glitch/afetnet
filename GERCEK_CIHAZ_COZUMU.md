# Gerçek iOS Cihazına Kurulum Çözümü

## ❌ Sorun: "VPN ve Cihaz Yönetimi"nde profil görünmüyor

Bu durum, uygulamanın cihaza düzgün kurulmadığı veya cihazın UDID'inin provisioning profile'a eklenmediği anlamına gelebilir.

## ✅ Çözüm Seçenekleri

### **Seçenek 1: Simulator Build (Önerilen - En Hızlı)**

Simulator build'i hiçbir profil gerektirmez ve hemen test edebilirsiniz:

1. **Simulator build başlatıldı** - Şu anda arka planda çalışıyor
2. Build tamamlandığında, `.app` dosyasını indirin
3. **Xcode Simulator'da test edin:**
   ```bash
   # Build tamamlandıktan sonra
   xcrun simctl install booted path/to/app.app
   ```

**Avantajları:**
- Profil gerektirmez
- Hızlı test
- Sorunsuz çalışır

### **Seçenek 2: Cihaz UDID'ini Kontrol Et ve Yeni Build Al**

Gerçek cihaz için build almak istiyorsanız:

1. **Cihazınızın UDID'sini öğrenin:**
   - Mac'te: Xcode > Window > Devices and Simulators > Cihazınızı seçin > Identifier (UDID)
   - Veya cihazda: Ayarlar > Genel > Hakkında > "IMEI" veya cihaz bilgileri
   - Terminal'de (cihaz USB'ye bağlıyken): `system_profiler SPUSBDataType | grep -A 11 iPhone`

2. **EAS credentials'ı güncelleyin:**
   ```bash
   eas credentials
   ```
   - iOS credentials seçin
   - Cihaz UDID'ini ekleyin

3. **Yeni build alın:**
   ```bash
   eas build --platform ios --profile development --non-interactive
   ```

### **Seçenek 3: Xcode ile Doğrudan Yükleme**

Native klasör zaten mevcut, Xcode ile doğrudan yükleyebilirsiniz:

1. **iOS klasörünü kontrol edin:**
   ```bash
   ls -la ios/
   ```

2. **Xcode'da açın:**
   ```bash
   open ios/AfetNet.xcworkspace
   ```
   - Veya `ios/AfetNet.xcodeproj` (workspace yoksa)

3. **Cihazınızı seçin ve Run (▶️) butonuna basın**
   - Xcode otomatik olarak provisioning profile'ı yönetir
   - Cihazı seçin (üstte device selector'dan)
   - Build ve Run yapın

**Not:** İlk kez çalıştırırken Xcode, cihazınızı developer mode'a geçirmenizi isteyebilir.

### **Seçenek 4: TestFlight (Production Build)**

TestFlight için production build gerekiyor:

```bash
eas build --platform ios --profile production
```

Build tamamlandıktan sonra App Store Connect'e submit edin ve TestFlight üzerinden test edin.

## 🔍 Cihaz Durumunu Kontrol Etme

### Uygulamanın gerçekten kurulup kurulmadığını kontrol edin:

1. **Ana ekranda uygulama ikonunu arayın**
   - "AfetNet" veya "Development Build" ikonu var mı?

2. **Ayarlar > Genel > iPhone Depolama** kontrol edin
   - Uygulama listede görünüyor mu?

3. **Eğer uygulama kurulduysa ama açılmıyorsa:**
   - Cihazı yeniden başlatın
   - Uygulamayı silip yeniden kurun
   - Xcode Device Logs'u kontrol edin (Xcode > Window > Devices and Simulators > View Device Logs)

## 📱 Şu Anda Yapılacaklar

1. **Simulator build bekleniyor** - Tamamlanınca test edin
2. **Alternatif olarak:** Xcode ile doğrudan yüklemeyi deneyin (Seçenek 3)

## 🆘 Hala Sorun mu Var?

Xcode Device Logs'u kontrol edin:
- Xcode > Window > Devices and Simulators
- Cihazınızı seçin > "View Device Logs"
- Uygulamayı açmayı deneyin ve logları inceleyin



