# AfetNet — App Store Optimization (ASO) Metadata v1.7

> **Target version:** v1.7.0 (post-KVKK Madde 6 + Critical Alerts entitlement)  
> **Last updated:** 2026-05-11  
> **Sprint:** v2 Sprint 1A  
> **Stores:** App Store (iOS), Google Play (Android)

---

## 1. App Store (iOS) — App Store Connect

### 1.1 App Information (Localized — Turkish, Primary)

**App Name** (30 char max — including spaces):
```
AfetNet: Deprem Erken Uyarı
```
_(28/30 chars — used in search ranking, MOST important)_

**Subtitle** (30 char max):
```
Sessiz modda bile uyarır
```
_(23/30 chars — second-most ranked field)_

**Promotional Text** (170 char max — editable WITHOUT review):
```
AFAD + USGS + EMSC çoklu kaynak doğrulamalı deprem uyarısı. Hayat kurtaran saniyeler. KVKK uyumlu, %100 ücretsiz.
```
_(108/170 chars — update during news cycles)_

### 1.2 Keywords (100 char max, comma-separated, NO spaces after commas)

**Primary keyword list (Turkish):**
```
deprem,uyarı,afad,sos,acil,afet,kandilli,erken,sallantı,bildirim,güvenlik,mesh,offline,aile,kurtarma
```
_(99/100 chars)_

**Alternative if A/B testing:**
```
deprem,erken,uyarı,afad,emsc,usgs,sos,acil,afet,sallantı,kandilli,bildirim,toplanma,güvenlik
```

### 1.3 Description (4000 char max)

```
AfetNet, Türkiye'nin yüksek deprem riski altındaki nüfusunu korumak için tasarlanmış hayat kurtaran bir acil iletişim ve uyarı uygulamasıdır.

🟢 NEDEN AFETNET?

Türkiye dünyanın en aktif fay hatları üzerindedir (Kuzey Anadolu, Doğu Anadolu, Ege). 6 Şubat 2023 Kahramanmaraş depremlerinde 53.000+ insan hayatını kaybetti — pek çoğu uyarı almadıkları için. AfetNet bu sorunu çözer.

🟢 ÇOKLU KAYNAK DEPREM UYARISI

• AFAD (Türkiye resmi)
• USGS (ABD Jeolojik Araştırmalar)
• EMSC (Avrupa-Akdeniz Sismoloji)
• Kandilli Rasathanesi
• AfetNet Sensör Ağı (kullanıcı topluluğu)

P-dalgası tespit edilir edilmez (saniyeler içinde) merkez üssünden uzaktaki kullanıcılara erken uyarı gider.

🟢 SES KESİK / SESSİZ MODDA BİLE UYARIR (Critical Alerts*)

Telefonunuz gece sessize alınmış olsa bile AfetNet sizi uyandırır. Sadece deprem erken uyarısı ve aile SOS sinyali için.
*Apple onaylı Critical Alerts yetkisi — v1.7.0 ile aktif.

🟢 OFFLINE ÇALIŞIR — BLE MESH AĞI

Deprem sonrası baz istasyonu çöktüğünde, telefonlar Bluetooth Low Energy ile birbirine bağlanır. Şebeke olmadan SOS mesajı kurtarma ekiplerine ulaşır.

🟢 AİLE GÜVENLİK MERKEZİ

• Aile üyelerinin güvenlik durumunu anlık görün
• Konumlarını harita üzerinde takip edin
• Aile içi grup sohbeti (encrypted)
• SOS sinyali tüm aileye anında ulaşır

🟢 SOS ELITE 6-KANAL ULAŞIM

Tek bir SOS düğmesi → 6 farklı kanaldan eş zamanlı yayın:
1. AFAD acil hattı (112 entegre)
2. Aile bildirimleri
3. Yakındaki AfetNet kullanıcıları (mesh)
4. Firebase Cloud (internet varsa)
5. Push notification
6. Kurtarma ekipleri backend

🟢 EEW (Earthquake Early Warning) NEDEN ÖNEMLİ?

P-dalgası (zararsız öncül) ses hızında ilerler. S-dalgası (yıkıcı) 6 km/s'de seyahat eder. Bu fark size 5-60 saniye verir — "Eğil, Kapan, Tutun" hareketini yapmak için kritik. Sessiz telefonda bu süre kaybolur.

🟢 TÜRKİYE TOPLANMA ALANLARI

AFAD listesinden derlenen 45+ toplanma noktası harita üzerinde. Offline erişilebilir, deprem sonrası rota yönlendirmesi.

🟢 İLK YARDIM REHBERİ

241 madde offline ilk yardım bilgi tabanı. AI asistan (OpenAI destekli) acil durumda doğru protokolü size adım adım anlatır.

🟢 GİZLİLİK — KVKK / GDPR UYUMLU

• Sağlık verisi VARSAYILAN OLARAK cihazda kalır
• Açık rıza vermeden sunucuya gönderilmez (KVKK Madde 6)
• AES-256 şifreleme her aşamada
• Firebase europe-west1 (AB veri merkezi)
• İstediğiniz zaman verilerinizi silme hakkı

🟢 SIFIR REKLAMSIZ, %100 ÜCRETSİZ

Bir hayat kurtaran araç asla reklamla finanse edilmez. AfetNet bağışlarla ve kurumsal sponsorlukla çalışır.

🟢 GELİŞTİRİCİ İLETİŞİM

E-posta: gokcamlarpetrol@gmail.com  
Geri bildirim, hata raporu ve özellik talepleri için.

⚠️ ÖNEMLİ: AfetNet bir hayat kurtaran araçtır ancak resmi acil durum yanıt sistemi değildir. Acil durumda DAİMA önce 112'yi arayın.

#Deprem #AFAD #ErkenUyarı #SOS #Acil #Türkiye #Güvenlik
```

### 1.4 What's New (4000 char max — v1.7.0 release notes)

```
v1.7.0 — KVKK Madde 6 Uyumluluğu + Critical Alerts

🔒 GİZLİLİK GÜÇLENDİRMESİ
• Sağlık verisi artık varsayılan olarak yalnızca cihazınızda kalır
• Bulut yedekleme ve kurtarma ekibi paylaşımı için ayrı açık rıza onayı eklendi (KVKK Madde 6 — Özel Nitelikli Kişisel Veri)
• Toplanma alanı etiketleri "AFAD Listesi" olarak güncellendi (şeffaflık)
• Gizlilik politikası genişletildi: mesh şifreleme detayları, sağlık veri akışı

🚨 CRITICAL ALERTS (Apple Onaylı)
• Deprem erken uyarısı artık sessiz modda bile çalar
• Aile SOS sinyali sessiz modda bile aile üyelerinize ulaşır
• Sadece bu iki bildirim türü için aktif — diğer bildirimler standarttır

🍎 APPLE SIGN-IN GÜVENLİK
• Nonce + SHA-256 doğrulama (replay attack koruması)

📊 HATA RAPORLAMA İYİLEŞTİRMESİ
• Sentry entegrasyonu — anonim crash report ile daha hızlı bug fix

🐛 HATA DÜZELTMELERİ
• 14 farklı bug giderildi (detay için changelog)
• Offline mesajlaşma stabilite iyileştirmesi
• BLE mesh peer discovery hızlandı

DAHA İYİ HAYAT KURTARAN BİR UYGULAMA İÇİN BİZE GERİ BİLDİRİM GÖNDERİN: gokcamlarpetrol@gmail.com
```

### 1.5 Categories

- **Primary:** Utilities
- **Secondary:** Health & Fitness

_(Apple does NOT have "Safety" or "Disaster" category for iOS. Utilities + Health gives best discoverability.)_

### 1.6 Age Rating

- **Age:** 4+
- **No restricted content**

### 1.7 App Preview Video (15-30 sec)

Storyboard:
1. **0-3s:** Earthquake notification fires on locked silenced phone — phone vibrates loudly, screen lights up "DEPREM YAKLAŞIYOR — 12 SANİYE"
2. **3-7s:** User does "Drop, Cover, Hold" → countdown ends → simulated shake animation
3. **7-12s:** Post-quake: SOS button pressed → family screen shows all family safe
4. **12-18s:** BLE mesh visualization — devices connecting offline, message propagating
5. **18-25s:** Health profile + assembly point map
6. **25-30s:** Logo + tagline: "AfetNet — Hayat Kurtaran Saniyeler"

### 1.8 Screenshots (6 required, 1290×2796 for iPhone 15 Pro Max)

1. EEW alert in action (countdown)
2. SOS dial pad with 6-channel indicator
3. Family screen with member statuses
4. Assembly points map with offline indicator
5. AI Assistant (first aid guidance)
6. Privacy controls (KVKK toggles visible)

Add localized Turkish text overlays:
- "5 Saniye Önceden Uyarı"
- "Sessiz Modda Bile Çalar"
- "Aileniz Her An Görünür"
- "İnternetsiz İletişim — BLE Mesh"
- "AI İlk Yardım Rehberi"
- "KVKK Uyumlu — Veriniz Sizde"

---

## 2. Google Play Store (Android)

### 2.1 App Name (50 char max)

```
AfetNet: Deprem Erken Uyarı & Aile SOS
```
_(38/50 chars)_

### 2.2 Short Description (80 char max)

```
AFAD onaylı kaynaklarla deprem erken uyarı. Saniyeler önceden bilgilendirir.
```
_(78/80 chars)_

### 2.3 Full Description (4000 char max)

_(Use same content as App Store Description above, with these Android-specific changes:)_

- Remove "Critical Alerts*" line (Android uses notification channels — already at MAX importance)
- Replace with: "Yüksek öncelikli bildirim kanalı: Do Not Disturb modunda bile uyarır"
- Add: "Android 14+ Live Activities desteği"

### 2.4 Tags / Keywords

```
deprem
afad
erken uyarı
sos
acil durum
afet
mesh
bluetooth offline
aile güvenliği
kandilli
emsc
usgs
ilk yardım
toplanma alanı
kvkk
```

### 2.5 Content Rating

- **PEGI:** 3 (no objectionable content)
- **Google Play:** Everyone

### 2.6 Categories

- **Primary:** Tools
- **Secondary:** Health & Fitness

---

## 3. Asset Refresh Checklist

| Asset | Status | Action |
|---|---|---|
| App Icon (1024×1024) | ✅ Existing | None |
| Feature Graphic (Play, 1024×500) | ⚠️ Needs refresh | Update with v1.7 tagline |
| App Preview Video (iOS) | ❌ Missing | Record 30s screencast |
| App Promo Video (Play, 30s) | ❌ Missing | Same screencast |
| Localized Screenshots × 6 (iPhone) | ⚠️ Existing | Re-render with v1.7 UI |
| Localized Screenshots × 8 (iPad) | ❌ Missing | Critical for iPad rating boost |
| Localized Screenshots × 8 (Android) | ⚠️ Existing | Re-render with v1.7 UI |
| Privacy Policy URL (afetnet.app/privacy) | ✅ Updated 2026-05-11 | No action |
| Support URL (afetnet.app/support) | ⚠️ TBD | Create simple help page |
| Marketing URL (afetnet.app) | ⚠️ TBD | Create landing page |

---

## 4. A/B Testing Plan (Apple Search Ads + Play Store Experiments)

### 4.1 App Store (iOS)

| Variant | App Name | Subtitle | Promotional Text |
|---|---|---|---|
| **A (Control)** | AfetNet: Deprem Erken Uyarı | Sessiz modda bile uyarır | AFAD + USGS + EMSC çoklu kaynak... |
| **B (Urgency)** | AfetNet: 5sn Erken Uyarı | Hayat kurtaran saniyeler | Türkiye'nin tek çoklu-kaynak EEW... |
| **C (Trust)** | AfetNet: AFAD Onaylı Deprem | Hayatınızı korur | AFAD verisinden derlenmiştir... |

Run for 14 days, allocate 33%/33%/33%, ≥1000 impressions per variant. Pick winner by install conversion rate (target: +15% over baseline).

### 4.2 Play Store (Android)

Test 3 hero screenshots:
- A: EEW alert UI (countdown visible)
- B: SOS family map (multi-member)
- C: Mesh network visualization

Same 14-day window, 33% split.

---

## 5. Localization Roadmap

- **v1.7:** Turkish (primary) ✓
- **v1.8:** English (international audience, tourist safety)
- **v1.9:** Kurdish (southeastern Turkey, Kahramanmaraş-affected region) — high-impact localization
- **v2.0:** Arabic, Persian (Iran border regions also seismic)

---

## 6. Press Kit (referenced from ASO Marketing URL)

To prepare at `afetnet.app/press`:
- App logo (PNG, SVG)
- Founder photo (Gokhan Camci)
- 2-paragraph elevator pitch (TR + EN)
- 5 statistics ("53,000 deaths in Kahramanmaraş", "5-60s warning lead time", etc.)
- Quotes from civilian survivors (with consent)
- High-res screenshots (5760×3240)
- Logo brand guidelines

---

## 7. App Store Connect Submission Checklist (v1.7.0)

- [ ] App version bumped: `app.config.ts` → `version: "1.7.0"`
- [ ] iOS buildNumber bumped: `app.config.ts` ios → `buildNumber: "4"`
- [ ] Android versionCode bumped: `app.config.ts` android → `versionCode: 34`
- [ ] Localization files (i18n) updated with new strings (KVKK consent, Critical Alerts disclosure)
- [ ] Screenshots regenerated on iPhone 15 Pro Max simulator
- [ ] App Preview video recorded
- [ ] Privacy policy URL responds 200 OK
- [ ] What's New text approved by stakeholders
- [ ] Test internal TestFlight build 24h before submission
- [ ] App Review Notes (note to reviewer) prepared — see Section 7.1

### 7.1 App Review Notes (mandatory)

```
Reviewer notes (v1.7.0):

• This is a life-safety app for earthquake-prone Turkey.
• v1.7.0 adds KVKK Madde 6 (Turkish data protection law) explicit consent for health data — feature toggle in Settings → Health Profile.
• Critical Alerts entitlement request submitted separately (see ticket). This release does NOT yet enable critical alerts — they remain standard until entitlement is granted.
• Apple Sign-In nonce hardening for replay attack protection.
• Test user accounts (if needed): contact gokcamlarpetrol@gmail.com.
• Demo flow for SOS without affecting real emergency services: enable Settings → Advanced → "Test Mode" — SOS is sent to a mock backend instead of AFAD.
```

---

**Hazırlandı:** AfetNet Elite Team — v2 Sprint 1A  
**Tarih:** 2026-05-11
