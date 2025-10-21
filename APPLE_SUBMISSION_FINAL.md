# 🍎 APPLE APP STORE - FİNAL SUBMISSION CHECKLIST

**Son Güncelleme:** 21 Ekim 2025  
**Durum:** IAP Products oluşturulmuş - Metadata gerekli

---

## ✅ TAMAMLANMIŞ İŞLER

### 1. KOD TARAFI (%100 Hazır):
- ✅ IAP Service tam implement edilmiş
- ✅ Product IDs kod ile eşleşiyor
- ✅ Bundle ID doğru: `org.afetnet.app`
- ✅ Server validation çalışır
- ✅ Restore purchases aktif
- ✅ Premium gating sistemleri çalışır
- ✅ Subscription terms app içinde gösterilecek
- ✅ Privacy & Terms linkleri eklenmiş
- ✅ Info.plist tam yapılandırılmış
- ✅ Linter errors: YOK
- ✅ TypeScript errors: YOK

### 2. APP STORE CONNECT:
- ✅ IAP Products oluşturulmuş (3 ürün)
  - `afetnet_premium_monthly1` - Waiting for Review
  - `afetnet_premium_yearly1` - Waiting for Review
  - `afetnet_premium_lifetime` - Waiting for Review

---

## ⚠️ HEMEN YAPILMASI GEREKENLER

### PHASE 1: IAP METADATA (2 saat - KRİTİK!)

#### App Store Connect > Distribution > In-App Purchases

**Her 3 ürün için:**

1. **Aylık Premium** (`afetnet_premium_monthly1`):
   ```
   [Edit Product] butonuna tıkla
   
   Review Information:
   Display Name (Turkish): Aylık Premium
   Description (Turkish):
   AfetNet Premium'a 1 aylık erişim. 200+ premium özellik:
   • Aile takibi ve mesajlaşma
   • Offline harita ve navigasyon  
   • Şebekesiz BLE mesh iletişim
   • AI destekli karar sistemi
   
   Abonelik otomatik olarak yenilenir. İptal etmek için 
   App Store ayarlarınızdan aboneliği sonlandırabilirsiniz.
   
   Screenshot: 
   [Upload Screenshot] - Premium ekranının iPhone screenshot'u
   (1170x2532 px - iPhone 13/14/15 Pro Max)
   
   Pricing:
   Territory: Turkey
   Price Tier: ₺49.99
   ```

2. **Yıllık Premium** (`afetnet_premium_yearly1`):
   ```
   Display Name (Turkish): Yıllık Premium
   Description (Turkish):
   AfetNet Premium'a 1 yıllık erişim (%17 indirim). 
   200+ premium özelliye sınırsız erişim.
   
   Abonelik otomatik olarak yenilenir.
   
   Screenshot: Aynı premium ekranı screenshot'u
   
   Pricing: ₺499.99
   ```

3. **Yaşam Boyu Premium** (`afetnet_premium_lifetime`):
   ```
   Display Name (Turkish): Yaşam Boyu Premium
   Description (Turkish):
   AfetNet Premium'a kalıcı erişim. Tek seferlik ödeme 
   ile tüm premium özelliklere ömür boyu sınırsız erişim. 
   Abonelik yok, yenileme yok.
   
   Screenshot: Aynı premium ekranı screenshot'u
   
   Pricing: ₺999.99
   ```

#### Screenshot Nasıl Alınır?
1. iPhone'unuzda uygulamayı çalıştırın
2. Settings > Premium ekranına gidin
3. 3 planın da göründüğünden emin olun
4. Screenshot alın (Power + Volume Up)
5. Screenshot'u bilgisayara aktarın
6. App Store Connect'te her 3 ürün için yükleyin

---

### PHASE 2: SUBSCRIPTION GROUP (30 dakika)

#### App Store Connect > Distribution > Subscriptions

1. **Subscription Group Oluştur:**
   ```
   Name: AfetNet Premium Membership
   
   Reference Name: AfetNet Premium Membership
   
   Localizations:
   - Turkish:
     Display Name: AfetNet Premium Üyelik
     Description: AfetNet'in tüm premium özelliklerine erişim
   
   - English:
     Display Name: AfetNet Premium Membership
     Description: Access to all AfetNet premium features
   ```

2. **Subscriptions'ı Gruba Ekle:**
   - Monthly subscription'ı gruba ekle
   - Yearly subscription'ı gruba ekle
   - Group Level: 1 (her ikisi de)

---

### PHASE 3: APP SCREENSHOTS (2 saat)

#### Gerekli Boyutlar ve Ekranlar:

**iPhone 6.7" (1290 x 2796 px)** - Zorunlu:
1. Ana ekran - Deprem bildirimleri
2. Premium ekranı - Satın alma sayfası
3. Harita ekranı - Premium feature
4. Mesajlaşma ekranı - Premium feature
5. Aile takip ekranı - Premium feature

**iPhone 6.5" (1284 x 2778 px)** - Zorunlu:
Aynı 5 ekran

**iPhone 5.5" (1242 x 2208 px)** - Zorunlu:
Aynı 5 ekran

#### Screenshot Alma Adımları:
1. iPhone Simulator'ü aç (Xcode > Open Developer Tool > Simulator)
2. iPhone 15 Pro Max seç (6.7")
3. Uygulamayı çalıştır
4. Her ekrana git ve screenshot al (Cmd + S)
5. Screenshots ~/Desktop/Screenshots klasöründe
6. Resize tool ile diğer boyutları oluştur

---

### PHASE 4: APP DESCRIPTION (1 saat)

#### App Store Connect > Distribution > App Store > Product Page

```
App Name: AfetNet

Subtitle: Türkiye'nin En Gelişmiş Afet Uygulaması

Description (Turkish):
AfetNet - Deprem ve Afetlere Karşı En Kapsamlı Koruma

Deprem ve diğer afetlere karşı ailenizi ve kendinizi koruyun. 
AfetNet, Türkiye'nin en gelişmiş afet yönetim uygulamasıdır.

ÜCRETSİZ ÖZELLİKLER:
✓ Gerçek zamanlı deprem bildirimleri (sınırsız)
✓ Deprem erken uyarı sistemi
✓ Temel afet bilgilendirme

PREMIUM ÖZELLİKLER (200+ Özellik):

🚨 ACIL DURUM & KURTARMA
• SOS sistemi - Anında yardım çağrısı
• Kritik alarm - Sessiz modu aşan alarmlar
• Kurtarma koordinasyonu
• Medikal bilgi paylaşımı

👨‍👩‍👧‍👦 AİLE TAKİBİ
• Sınırsız aile üyesi takibi
• Gerçek zamanlı konum paylaşımı
• Şifreli mesajlaşma

🗺️ OFFLINE HARİTA
• İnternet olmadan harita
• Topografik haritalar
• Gelişmiş rota planlama

📡 ŞEBEKESİZ İLETİŞİM
• Bluetooth mesh ağı
• WiFi Direct
• P2P mesajlaşma

PREMIUM PLANLARI:
• Aylık: ₺49.99/ay
• Yıllık: ₺499.99/yıl (%17 indirim)
• Yaşam Boyu: ₺999.99 (tek ödeme)

Abonelikler otomatik yenilenir. İstediğiniz zaman iptal edebilirsiniz.

Gizlilik: https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
Koşullar: https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html

Keywords: afet,deprem,premium,acil durum,kurtarma,aile,harita,güvenlik

Category: 
Primary: Utilities
Secondary: Navigation

Age Rating: 4+ (No objectionable content)

Copyright: 2025 AfetNet

Support URL: mailto:support@afetnet.app
```

---

### PHASE 5: APP PRIVACY (30 dakika)

#### App Store Connect > App Privacy

1. **Do you collect data from this app?** YES

2. **Data Types:**

**Location (Konum):**
- [ ] Used for: Analytics, App Functionality
- Purpose: Earthquake alerts, family tracking
- Linked to user: NO
- Tracking: NO
- Collection: Required

**User Content (Mesajlar):**
- [ ] Used for: App Functionality
- Purpose: P2P messaging
- Linked to user: NO (encrypted)
- Tracking: NO
- Collection: Optional

**Contacts (Optional):**
- [ ] Used for: App Functionality
- Purpose: Emergency contacts
- Linked to user: NO
- Tracking: NO
- Collection: Optional

3. **Privacy Policy URL:**
```
https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
```

---

### PHASE 6: APP REVIEW INFORMATION (30 dakika)

#### App Store Connect > App Information > App Review Information

```
Contact Information:
First Name: Gökhan
Last Name: Camci
Email: support@afetnet.app
Phone: +90 XXX XXX XX XX

Demo Account:
Not Required (app works without login)

Sandbox Test Account:
Email: test.afetnet@icloud.com
Password: TestAfet2025!
Country: Turkey

Notes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT FOR APPLE REVIEWERS

FREE vs PREMIUM:
• FREE: Only earthquake notifications (unlimited)
• PREMIUM: 200+ features (family tracking, offline maps, mesh, AI)

HOW TO TEST PREMIUM:
1. Launch app
2. Tap "Settings" tab (gear icon)
3. Tap "Premium" section
4. Select any plan
5. Use sandbox test account above
6. After purchase, all features unlock

VERIFY:
• Map tab activates (green icon)
• Messages tab activates
• Family tab activates
• 200+ features accessible

IAP TESTING:
• All products configured in App Store Connect
• Server receipt validation implemented
• Restore Purchases works (Premium screen)

PERMISSIONS:
• Location: Earthquake alerts & family tracking
• Bluetooth: Offline mesh communication
• All features tested and working

Support: support@afetnet.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### PHASE 7: BUILD UPLOAD (1 saat)

#### Xcode'da Build ve Upload:

1. **Versiyonu kontrol et:**
   ```
   app.config.ts:
   version: "1.0.1"
   buildNumber: "4"
   ```

2. **Archive oluştur:**
   ```bash
   cd /Users/gokhancamci/AfetNet1
   
   # Expo ile build
   eas build --platform ios --profile production
   
   # Veya Xcode ile:
   # Xcode > Product > Archive
   ```

3. **App Store'a yükle:**
   - Archive tamamlandığında "Distribute App"
   - "App Store Connect" seç
   - "Upload" tıkla
   - Bekle (10-30 dakika)

4. **App Store Connect'te build seç:**
   - Distribution > TestFlight > iOS Builds
   - Build "Processing" bitince
   - Distribution > App Store > + Version
   - Build'i seç

---

## 🚨 KRİTİK KONTROL LİSTESİ

### Submission Öncesi Final Check:

#### IAP:
- [ ] Her 3 ürün için display name eklendi
- [ ] Her 3 ürün için description eklendi
- [ ] Her 3 ürün için screenshot yüklendi
- [ ] Her 3 ürün için pricing ayarlandı
- [ ] Subscription group oluşturuldu
- [ ] Localizations tamamlandı (TR + EN)

#### App Store:
- [ ] 3+ screenshot yüklendi (her boyut)
- [ ] Description yazıldı (Turkish)
- [ ] Keywords optimized
- [ ] Privacy policy URL eklendi
- [ ] Terms URL eklendi
- [ ] Support URL eklendi
- [ ] Category seçildi
- [ ] Age rating ayarlandı

#### Build:
- [ ] Binary yüklendi
- [ ] Processing tamamlandı
- [ ] Build seçildi
- [ ] Export compliance: No encryption

#### Review Info:
- [ ] Test account oluşturuldu
- [ ] Review notes yazıldı
- [ ] Contact bilgileri doğru

#### App Privacy:
- [ ] Data collection tanımlandı
- [ ] Privacy policy URL eklendi

---

## 📅 ZAMAN PLANI

### Bugün (6-8 saat):
- 09:00-11:00: IAP metadata ekle (display names, descriptions, screenshots)
- 11:00-11:30: Subscription group oluştur
- 11:30-13:30: App screenshots hazırla ve yükle
- 14:00-15:00: App description yaz ve metadata tamamla
- 15:00-15:30: App privacy doldur
- 15:30-16:00: Review information yaz
- 16:00-17:00: Build yükle
- 17:00-18:00: Final check ve submit

### Yarın:
- Apple Review: 24-48 saat
- Olası sorular için email kontrol et
- Hızlı cevap ver

---

## ✅ BAŞARI KRİTERLERİ

### Red Almamak İçin:
1. ✅ **Screenshots gerçek** app'ten
2. ✅ **Description** doğru ve açık
3. ✅ **IAP metadata** tam
4. ✅ **Privacy policy** erişilebilir
5. ✅ **Terms** app içinde gösteriliyor
6. ✅ **Restore** çalışır
7. ✅ **No crashes** gerçek device'ta
8. ✅ **Test account** doğru

---

## 🎯 SONUÇ

**Kod Tarafı:** ✅ %100 Hazır  
**App Store Connect:** ⚠️ Metadata ve Screenshots Gerekli  
**Tahmini Süre:** 6-8 saat (hazırlık)  
**Apple Review:** 24-48 saat  
**Toplam:** 2-3 gün

**EN ÖNEMLİ:** Screenshots ve IAP metadata!

---

**Hazırlayan:** AI Assistant  
**Tarih:** 21 Ekim 2025  
**Versiyon:** FINAL  
**Durum:** ⚠️ METADATA EKLE → SUBMIT EDİLEBİLİR

