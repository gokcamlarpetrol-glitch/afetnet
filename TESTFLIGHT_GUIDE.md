# AfetNet - TestFlight Hazırlık Rehberi

## 🧪 TESTFLIGHT TESTI - EKSİKSİZ REH

BER

### 1. TEST KULLANICILARI

**Internal Testing (Apple Team Members):**
- Maksimum 100 tester
- Apple ID ile otomatik erişim
- Review gerektirmez
- Hemen test başlayabilir

**External Testing (Public Beta):**
- Maksimum 10,000 tester
- Email ile davet
- Apple review gerektirir
- Public link ile paylaşılabilir

---

### 2. BUILD HAZIRLAMA

```bash
# 1. Version ve build number güncel mi kontrol et
# app.config.ts
version: "1.0.0"
ios.buildNumber: "1"

# 2. Production build al
eas build --platform ios --profile production

# 3. Build tamamlandığında EAS dashboard'dan indir
# veya otomatik App Store Connect'e yüklensin
```

---

### 3. APP STORE CONNECT AYARLARI

#### TestFlight Bilgileri
**What to Test (Test Edilecekler):**
```
TESTFLIGHT BETA TEST - VERSION 1.0.0

🎯 ÖNCELİKLİ TEST EDİLMESİ GEREKENLER:

1. SOS SİSTEMİ
   - SOS butonu çalışıyor mu?
   - Konum doğru gönderiliyor mu?
   - Bluetooth mesh SOS yayını çalışıyor mu?

2. BLUETOOTH MESH
   - İki cihaz birbirini buluyor mu?
   - Mesajlar iletiliyor mu?
   - Offline mod çalışıyor mu?

3. DEPREM BİLDİRİMLERİ
   - Bildirimler geliyor mu?
   - Ses seviyesi yeterli mi?
   - P-wave algılama çalışıyor mu?

4. AİLE TAKİBİ
   - QR kod ile eşleştirme çalışıyor mu?
   - Konum paylaşımı doğru mu?
   - Mesajlaşma şifreli mi?

5. ENKAZ MODU
   - Sesli sinyal çalışıyor mu?
   - Işıklı sinyal (flaş) çalışıyor mu?
   - Otomatik SOS yayını aktif mi?

⚠️ BİLİNEN SORUNLAR:
- Premium features şu anda disabled (Apple IAP entegrasyonu bekleniyor)
- Bazı TypeScript warnings var ama build'i etkilemiyor

🙏 GERİ BİLDİRİM:
- Crash veya donma varsa hemen bildirin
- Battery drain (batarya tüketimi) yüksek mi?
- Bluetooth range (menzil) yeterli mi?
- UI/UX iyileştirme önerileri

📧 İletişim: beta@afetnet.app
```

**Beta App Description:**
```
AfetNet - Hayat Kurtaran Acil Durum Ağı

Bu beta versiyonda:
✅ SOS sistemi
✅ Bluetooth mesh networking
✅ Deprem erken uyarısı
✅ Aile takibi ve mesajlaşma
✅ Enkaz modu

Test ederken lütfen tüm permissions'ları (izinleri) verin:
- Location (Always)
- Bluetooth
- Notifications
- Microphone
- Camera

İyi testler!
```

#### Beta App Review Information
**Review Notes:**
```
TestFlight Beta Review Notes:

1. PERMISSIONS REQUIRED
   All permissions must be granted for full functionality:
   - Location (Always): For SOS and family tracking
   - Bluetooth: For offline mesh network
   - Notifications: For earthquake alerts
   - Microphone: For emergency voice signals
   - Camera: For QR code scanning

2. TESTING WITH MULTIPLE DEVICES
   Best tested with 2+ devices to experience:
   - Bluetooth mesh messaging
   - Offline SOS broadcast
   - Family member pairing

3. OFFLINE FEATURES
   - Turn on Airplane Mode
   - Keep Bluetooth ON
   - Test offline messaging

4. PREMIUM FEATURES
   Premium features are currently disabled.
   Will be enabled with Apple IAP in next update.

5. DEMO ACCOUNT
   Email: tester@afetnet.app
   Password: TestFlight2025!

Thank you!
```

---

### 4. TEST KULLANICI GRUPLARI

#### Grup 1: Internal Team (10 kişi)
- Developers
- QA team
- Product managers

**Test Focus:**
- Stability testing
- Performance testing
- Battery drain testing
- Bluetooth range testing

#### Grup 2: Power Users (50 kişi)
- Tech-savvy users
- Early adopters
- Beta testers

**Test Focus:**
- Feature testing
- UX feedback
- Edge cases
- Multi-device testing

#### Grup 3: Public Beta (500+ kişi)
- General public
- Earthquake-prone regions
- Families

**Test Focus:**
- Real-world usage
- Onboarding experience
- Daily usage patterns
- Feature discovery

---

### 5. TEST SEÇNARYOLARİ

#### Senaryo 1: SOS Acil Durum
1. SOS butonuna bas
2. Konum izni ver
3. SOS sinyali gönderildi mi kontrol et
4. Bluetooth mesajı yayınlandı mı kontrol et
5. Aile üyelerine bildirim gitti mi?

#### Senaryo 2: Offline Mesajlaşma
1. İki cihaz hazırla
2. Her ikisinde de AfetNet aç
3. Bluetooth izni ver
4. Airplane Mode aç (Wi-Fi/Cellular kapalı, Bluetooth açık)
5. Mesaj gönder
6. Diğer cihazda mesaj geldi mi?

#### Senaryo 3: Deprem Bildirimi
1. Bildirimlere izin ver
2. AFAD test bildirimi bekle
3. Bildirim geldi mi?
4. Ses yeterince yüksek mi?
5. Vibration çalıştı mı?

#### Senaryo 4: Aile Eşleştirme
1. İki cihaz hazırla
2. Birinde QR kodu oluştur
3. Diğerinde QR kodu tara
4. Eşleştirme başarılı oldu mu?
5. Konum paylaşımı çalışıyor mu?

#### Senaryo 5: Enkaz Modu
1. Enkaz modunu aç
2. Sesli sinyal başladı mı?
3. Flaş yanıp sönüyor mu?
4. Bluetooth beacon yayını aktif mi?
5. Batarya tüketimi nasıl?

---

### 6. GERİ BİLDİRİM TOPLAMA

#### Otomatik Crash Raporları
- Sentry integration aktif
- Tüm crashler otomatik raporlanıyor
- Stack traces ile detaylı analiz

#### Manuel Feedback
- In-app feedback button
- Email: beta@afetnet.app
- TestFlight'ta "Send Beta Feedback"

#### Metrics Tracking
- Daily Active Users (DAU)
- Feature usage statistics
- Battery consumption
- Bluetooth connection success rate
- SOS activation count

---

### 7. BETA RELEASE SCHEDULE

#### Week 1: Internal Testing
- Days 1-3: Developer team testing
- Days 4-7: QA team testing
- Fix critical bugs

#### Week 2: Power Users
- Days 8-10: Invite 50 power users
- Days 11-14: Collect feedback
- Fix high-priority bugs

#### Week 3: Public Beta
- Days 15-17: Invite 500 public testers
- Days 18-21: Monitor usage and feedback
- Fix remaining bugs

#### Week 4: Final Testing
- Days 22-25: Final bug fixes
- Days 26-28: Regression testing
- Day 29-30: Prepare for App Store submission

---

### 8. BAŞARILI BİR BETA İÇİN KRİTERLER

✅ **Stability:**
- Crash rate < 0.1%
- No memory leaks
- Smooth performance

✅ **Functionality:**
- All core features working
- No critical bugs
- Good Bluetooth range

✅ **User Satisfaction:**
- Positive feedback > 80%
- Feature requests noted
- UX issues identified

✅ **Battery:**
- Background battery drain < 5%/hour
- Foreground usage acceptable
- No unexpected battery spikes

---

### 9. YAYIN ÖNCESİ SON KONTROL LİSTESİ

- [ ] All beta feedback addressed
- [ ] Critical bugs fixed
- [ ] Performance optimized
- [ ] Battery consumption acceptable
- [ ] Bluetooth range tested
- [ ] SOS system fully functional
- [ ] Earthquake alerts working
- [ ] Family tracking stable
- [ ] Privacy policy updated
- [ ] App Store screenshots ready
- [ ] App Store description finalized
- [ ] Review notes prepared

---

### 10. APPLE'A GÖNDER

```bash
# Final production build
eas build --platform ios --profile production

# App Store Connect'te:
1. TestFlight testing completed ✅
2. Screenshots uploaded ✅
3. Description written ✅
4. Privacy details filled ✅
5. Pricing set (Free) ✅
6. Submit for review

# Expected review time: 1-3 days
```

---

## 🎯 SONUÇ

TestFlight başarılı olursa:
- ✅ App Store'a güvenle gönderebilirsin
- ✅ Kullanıcı geri bildirimleri ile iyileştirme yaparsın
- ✅ Kritik bugları erkenden yakalarısın
- ✅ Launch day sorunsuz geçer

**AFETNET TESTFLIGHT HAZIR!** 🧪🚀

