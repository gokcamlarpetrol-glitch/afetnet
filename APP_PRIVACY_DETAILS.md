# AfetNet - App Privacy Details (Apple App Store)

## 📋 Apple App Store Connect için Veri Toplama Beyanı

### 1. LOCATION (Konum)
**Toplanan Veriler:**
- Precise Location (Hassas Konum) ✅
- Coarse Location (Yaklaşık Konum) ✅

**Kullanım Amaçları:**
- **App Functionality** - SOS sinyali gönderme, kurtarma ekiplerine konum bildirme
- **Product Personalization** - Yakındaki toplanma noktalarını gösterme
- **Analytics** - Deprem etkilenen bölgeleri analiz etme (anonim)

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** EVET ✅ (SOS ve aile takibi için gerekli)

---

### 2. CONTACT INFO (İletişim Bilgileri)
**Toplanan Veriler:**
- Name (İsim) ✅
- Phone Number (Telefon Numarası) ✅ (Opsiyonel)

**Kullanım Amaçları:**
- **App Functionality** - Aile üyelerini tanımlama
- **Product Personalization** - Profil oluşturma

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** EVET ✅

---

### 3. HEALTH & FITNESS (Sağlık)
**Toplanan Veriler:**
- Health (Sağlık Durumu) ✅ (Kullanıcı tarafından girilen)

**Kullanım Amaçları:**
- **App Functionality** - Acil durumlarda sağlık bilgisi paylaşma (kan grubu, alerjiler)

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** EVET ✅

---

### 4. IDENTIFIERS (Tanımlayıcılar)
**Toplanan Veriler:**
- Device ID (Cihaz ID) ✅
- User ID (Kullanıcı ID - AFN-ID) ✅

**Kullanım Amaçları:**
- **App Functionality** - Bluetooth mesh ağında cihazları tanımlama
- **Analytics** - Crash raporları (Sentry)

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** EVET ✅

---

### 5. DIAGNOSTICS (Teşhis Verileri)
**Toplanan Veriler:**
- Crash Data (Çökme Verileri) ✅
- Performance Data (Performans Verileri) ✅

**Kullanım Amaçları:**
- **App Functionality** - Hataları tespit etme ve düzeltme

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** HAYIR ❌ (Anonim)

---

### 6. USAGE DATA (Kullanım Verileri)
**Toplanan Veriler:**
- Product Interaction (Özellik Kullanımı) ✅

**Kullanım Amaçları:**
- **Analytics** - Hangi özelliklerin kullanıldığını anlama
- **App Functionality** - Kullanıcı deneyimini iyileştirme

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** HAYIR ❌ (Anonim)

---

### 7. USER CONTENT (Kullanıcı İçeriği)
**Toplanan Veriler:**
- Messages (Mesajlar) ✅
- Photos (Fotoğraflar) ✅ (Opsiyonel - QR kod için)

**Kullanım Amaçları:**
- **App Functionality** - Aile üyeleriyle iletişim, QR kod paylaşımı

**Tracking için kullanılıyor mu?** HAYIR ❌
**User'a bağlı mı?** EVET ✅
**Encryption:** END-TO-END ENCRYPTED 🔐

---

## ⚠️ ÖNEMLİ NOTLAR

### Apple'a Beyan Edilmesi Gerekenler:
1. **Bluetooth kullanımı** - Offline mesh network için
2. **Background location** - Aile takibi ve deprem erken uyarısı için
3. **Push notifications** - Deprem bildirimleri için
4. **Health data** - Kullanıcı tarafından girilen sağlık bilgileri

### Apple'ın RED YAPABİLECEĞİ DURUMLAR:
❌ Location tracking for advertising (YOK)
❌ Data satışı (YOK)
❌ Third-party tracking (YOK)
❌ Açıklanmayan veri toplama (YOK)

### GÜVENLİK ÖNLEMLERİ:
✅ End-to-end encryption (E2EE)
✅ Local-first data storage
✅ No user data sold
✅ No advertising
✅ No third-party analytics (except Sentry for crash reports)

---

## 📝 App Store Connect'te Yapılacaklar

1. **App Privacy** bölümünde yukarıdaki tüm data types'ı seç
2. Her data type için kullanım amacını belirt
3. "Used for Tracking" için tüm data types'ta **NO** seç
4. "Linked to User" için uygun olanları **YES** seç
5. Privacy Policy linkini ekle: `https://afetnet.app/privacy`
6. Terms of Service linkini ekle: `https://afetnet.app/terms`

---

## ✅ SONUÇ

AfetNet **%100 Apple Privacy Standards'a uygun**:
- Şeffaf veri toplama
- Kullanıcı mahremiyetine saygı
- No tracking
- No ads
- End-to-end encryption
- Life-saving purpose (Apple'ın hoşuna gider! 🚀)

