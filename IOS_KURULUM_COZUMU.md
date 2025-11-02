# iOS Development Build Kurulum ve Sorun Giderme

## ✅ Build Başarılı
Build tamamlandı ve `.ipa` dosyası hazır.

## 📱 iOS Cihazına Kurulum Sonrası Açılmama Sorunu

### **Çözüm 1: Geliştirici Sertifikasına Güven Verin**

1. **iOS cihazınızda:**
   - **Ayarlar** (Settings) uygulamasını açın
   - **Genel** (General) > **VPN ve Cihaz Yönetimi** (VPN & Device Management)
     - *Not: Bazı iOS versiyonlarında "Profiller ve Cihaj Yönetimi" (Profiles & Device Management) olarak görünebilir*

2. **"Developer App" bölümünü bulun:**
   - "Gökhan ÇAMCI (Individual)" veya benzer bir geliştirici profili göreceksiniz
   - Profile dokunun

3. **"Güven" butonuna dokunun:**
   - Açılan onay penceresinde tekrar **"Güven"** deyin
   - Profil artık "Doğrulandı" (Verified) olarak görünecek

4. **Uygulamayı tekrar açmayı deneyin**

### **Çözüm 2: Cihazı Yeniden Başlatın**

Bazen sertifikaya güven verdikten sonra cihazı yeniden başlatmak gerekebilir:
- iPhone'u kapatıp açın
- Uygulamayı tekrar deneyin

### **Çözüm 3: Development Server Bağlantısı**

Uygulama açıldıktan sonra development server'a bağlanmanız gerekiyor:

#### **Development Server'ı Başlatın:**

```bash
npm run start:lan
```

**ÖNEMLİ:** 
- Telefon ve bilgisayar **aynı WiFi ağında** olmalı
- LAN modu kullanıldığı için aynı network'te olmak zorunlu

#### **Uygulamada Bağlanın:**

1. Uygulamayı açın
2. QR kod tarayın veya **"Enter URL manually"** butonuna dokunun
3. Terminal'de görünen URL'i manuel olarak girebilirsiniz (örnek: `http://192.168.1.2:8082`)

### **Hata Durumunda:**

#### **Uygulama hiç açılmıyorsa:**

1. **Ayarlar > Genel > VPN ve Cihaz Yönetimi** kontrol edin
2. Geliştirici sertifikasına güven verdiğinizden emin olun
3. Cihazı yeniden başlatın
4. Uygulamayı silip tekrar kurun

#### **"Untrusted Developer" hatası alıyorsanız:**

- Bu, sertifikaya güven vermediğiniz anlamına gelir
- Yukarıdaki "Çözüm 1" adımlarını takip edin

#### **Uygulama açılıyor ama development server bulunamıyor:**

- `npm run start:lan` komutunun çalıştığından emin olun
- Telefon ve bilgisayarın aynı WiFi ağında olduğunu kontrol edin
- Firewall'un 8082 portunu engellemediğinden emin olun
- Terminal'deki URL'i manuel olarak girin

## 📋 Kurulum Checklist

- [ ] `.ipa` dosyası cihaza indirildi
- [ ] Uygulama yüklendi
- [ ] **Ayarlar > Genel > VPN ve Cihaz Yönetimi** bölümünde geliştirici sertifikasına güven verildi
- [ ] Cihaz yeniden başlatıldı (gerekirse)
- [ ] Development server başlatıldı (`npm run start:lan`)
- [ ] Telefon ve bilgisayar aynı WiFi ağında
- [ ] Uygulamada development server'a bağlanıldı

## 🔗 Yararlı Linkler

- **Build Logları:** https://expo.dev/accounts/gokhancamci1/projects/afetnet/builds/33e3a157-37c1-4567-a40a-0cb981eb0e49
- **Application Archive:** https://expo.dev/artifacts/eas/7pCPARRy9GtdWLYB4FCFR4.ipa

## 🆘 Hala Sorun mu Var?

1. Cihaz loglarını kontrol edin (Xcode > Window > Devices and Simulators)
2. Terminal'de development server hatalarını kontrol edin
3. Build loglarını inceleyin (yukarıdaki link)



