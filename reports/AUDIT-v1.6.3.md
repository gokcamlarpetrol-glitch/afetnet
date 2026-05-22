# AfetNet v1.6.3 — Yayın Öncesi Tam Audit Raporu

> **Tarih:** 2026-05-20
> **Kapsam:** Onboarding'den itibaren tüm uygulama — 12 uzman paralel inceleme
> **Yöntem:** Elite Team — her uzman kendi alanında bağımsız derin audit
> **Mevcut sürüm:** v1.6.3 (yayında, güncelleme planlanıyor)

---

## 1. YÖNETİCİ ÖZETİ

12 uzman alanının her biri uygulamayı bağımsız taradı. Sonuç:

| Karar | Uzman alanı |
|---|---|
| **NO-GO** | Backend |
| **CONDITIONAL NO-GO** | iOS Native, Android Native, Mobil Güvenlik, QA, Privacy/KVKK |
| **CONDITIONAL GO** | RN/Expo Mimari, Database, Performance, UX, Safety Ops, Release |
| **GO** | Ürün (v1.6 için; v1.7 kapsam gerekli) |

### Konsolide karar: **NO-GO** — şu anki haliyle güncelleme yayınlanmamalı.

Sebep: Yalnızca kozmetik sorunlar değil — **gerçek exploit vektörleri** (5 sahte raporla ulusal EEW tetikleme, BLE mesh trafiğini dinleme, tüm kullanıcı profillerini dökme), **kesin crash** (Android 14 foreground service), ve **store reject blocker'ları** (iOS ATT, Privacy Manifest) mevcut.

İyi haber: P0'ların çoğu **S/M efor** (saatler–2 gün). Tek uzun lead-time öğesi Apple Critical Alert başvurusu (1-4 hafta) — **bu hemen başlatılmalı, paralel yürür**.

### Sayılarla
- **~40 ham P0 bulgu** → tema bazlı **11 iş paketi**
- **~35 P1**, ~40 P2/P3
- Tahmini P0 düzeltme: **en iyi 4-5 iş günü, en kötü 9-10 iş günü** (Apple başvuru lead-time hariç)

---

## 2. P0 — YAYIN BLOCKER'LARI (tema bazlı konsolide)

> Efor: **S** = <4 saat · **M** = 1-2 gün · **L** = 3-5 gün · **XL** = 1+ hafta

### ■ P0-TEMA-1 — Platform servis beyanları eksik (KESİN CRASH + STORE REJECT)
**Uzmanlar:** Android, iOS, Release · **Efor: M**

- **Android `foregroundServiceType` eksik** — `android/app/src/main/AndroidManifest.xml`'de hiç `<service>` bloğu yok (doğrulandı). Android 14 (targetSdk 35) cihazda FamilyTracking/BLE/EEW foreground servisi `startForeground()` çağrısında `MissingForegroundServiceTypeException` → **anında crash**. Türkiye kullanıcı tabanının çoğunluğu (Samsung Android 14) etkilenir.
- **Android `FOREGROUND_SERVICE_MICROPHONE` beyan yok** — VoiceCall WebRTC için zorunlu (API 34+).
- **iOS `audio` + `voip` background mode eksik** — `app.config.ts` UIBackgroundModes'da yok. WebRTC sesli arama arka planda kesilir; Apple Guideline 2.5.4 reject.

**Aksiyon:** Manifest'e `<service>` declaration'ları + `foregroundServiceType` (`location`, `connectedDevice`, `microphone`); `app.config.ts`'e `FOREGROUND_SERVICE_MICROPHONE` + iOS `audio`/`voip`; `expo prebuild`. **Alternatif:** VoiceCall production'da feature flag ile kapalıysa beyanlar gereksiz — flag durumu netleştir.

### ■ P0-TEMA-2 — iOS Critical Alert + lock-screen EEW (HAYAT GÜVENLİĞİ + LEAD-TIME)
**Uzmanlar:** iOS, UX, QA, Safety Ops · **Efor: M (kod) + 1-4 hafta Apple başvuru**

- `ios/AfetNetAcilletiim/AfetNetAcilletiim.entitlements`'da `com.apple.developer.usernotifications.critical-alerts` **yok** (doğrulandı). `NotificationPermissionHandler.ts:110` `allowCriticalAlerts: true` istiyor ama entitlement olmadan **silent fail**.
- Sonuç: Telefon sessiz moddayken / gece DND'de **deprem alarmı çalmaz**. EEW tam ekran alert (`SOSFullScreenAlert.tsx`) kilitli ekranda görünmez.

**Aksiyon:** (1) **BUGÜN** Apple Developer Portal'da Critical Alerts capability başvurusu yap — gerekçe: EEW/SOS kamu güvenliği. (2) Onay gelince entitlement + payload `critical: true`. (3) Onay beklenirken diğer işler paralel yürür; ancak entitlement yokken EEW kritik-alert özelliği Marketing'de **vadedilemez**.

### ■ P0-TEMA-3 — Backend exploit vektörleri (ULUSAL ÖLÇEKTE KÖTÜYE KULLANIM)
**Uzmanlar:** Backend, Database · **Efor: M**

- **Sahte sismik rapor → ulusal EEW** — `functions/src/admin.ts:834` `onSeismicReportCreated` RTDB trigger'ında auth yok; `userId` client-set. `CLUSTER_THRESHOLD=5` → **5 sahte raporla ulusal deprem alarmı tetiklenebilir**. RTDB rules `seismic_reports` write'ı kilitlemeli.
- **eewWebhook timing oracle** — `functions/src/eew.ts:1445` API key uzunluk kontrolü `timingSafeEqual`'dan önce erken return → key uzunluğu sızdırılıyor (brute-force daraltır). Aynı sorun `eewEmergencyTrigger` (`eew.ts:1224`).
- **openAIChatProxy wildcard CORS** — `admin.ts:419` `!reqOrigin` → `Access-Control-Allow-Origin: *`. ID token gate var ama gereksiz attack surface.

**Aksiyon:** RTDB rules `seismic_reports`/`plum_observations` write'ı `auth != null` + `userId == auth.uid`; uzunluk kontrolünü timing-safe compare içine al; CORS wildcard kaldır.

### ■ P0-TEMA-4 — Firestore rules veri sızıntısı / yetki yükseltme
**Uzmanlar:** Database · **Efor: M**

- **`users` koleksiyonu list açık** — `firestore.rules:735` `allow read: if isAuthenticated()` (get+list birlikte). Herhangi bir kullanıcı tüm profilleri (qrId, displayName, status) dump edebilir; `status=sos` kullanıcı listesi çekilebilir. → `allow get` / `allow list: if isAdmin()` ayır.
- **`families` admin hijack** — `firestore.rules:1057` update rule kötü niyetli üyenin kendini admin yapmasına / üye çıkarmasına izin veriyor. → `affectedKeys().hasOnly(...)` + `createdBy` koruması.
- **`devices` ownership hijack** — `firestore.rules:406` "migration-safe claim": `ownerUid` string değilse herhangi biri cihazı sahiplenebilir → aile konum/SOS/mesaj erişimi. → claim rule'u kaldır / `isAdmin()`.

### ■ P0-TEMA-5 — BLE mesh şifreleme kırık (MESH SOS/SAĞLIK VERİSİ AÇIKTA)
**Uzmanlar:** Mobil Güvenlik, Safety Ops · **Efor: L**

- **Key-in-payload** — `MeshCryptoService.ts:417` `encryptBroadcast` simetrik anahtarı ciphertext ile **aynı payload içinde** gönderiyor (`{ ct, k }`). Yakındaki herhangi bir BLE tarayıcı SOS koordinatlarını, sağlık verisini, konumu okuyabilir. Authenticated encryption güvencesi tamamen yok. KVKK Madde 12 ihlali.
- **Sağlık verisi `gated` fallback denetimsiz** — `EmergencyHealthSharingService.ts:376` `sendToPeer` yoksa `broadcastPacket({ gated:true })` çağırıyor; `MeshNetworkService` `gated`'i gerçekten uyguluyor mu doğrulanmamış → kan grubu/alerji/ilaç tüm BLE menzilindekilere yayılabilir.

**Aksiyon:** Broadcast şifrelemeyi yeniden tasarla — simetrik key ayrı kanaldan (ECDH / preshared aile anahtarı). Kısa vade: broadcast'i kapat, sadece P2P şifreli `sendToPeer`. `broadcastPacket`'te `gated && !recipientIds` → throw.

### ■ P0-TEMA-6 — Yerel depolama şifresiz (PII + KİMLİK + SAĞLIK)
**Uzmanlar:** Mobil Güvenlik · **Efor: M**

- `src/core/utils/storage.ts:144` `new MMKV({ id: 'afetnet-storage-v2' })` — `encryptionKey` yok. İçerik: kimlik cache (uid+email+photoURL), Apple gerçek ad, sağlık paylaşım flag'leri, kripto public key'ler. `adb backup` / jailbreak / adli araçla okunabilir.
- CryptoService fallback (`CryptoService.ts:113`): SecureStore yoksa **private key şifresiz MMKV'ye** düşüyor.

**Aksiyon:** SecureStore'dan (Keychain/Keystore) rastgele anahtar → MMKV `encryptionKey`. SecureStore yoksa E2EE'yi başlatma, kullanıcıyı uyar — key'i asla düz yazma.

### ■ P0-TEMA-7 — SOS akışı: yanlış güven & sessiz başarısızlık (HAYAT TEHLİKESİ)
**Uzmanlar:** Safety Ops, QA, UX · **Efor: M**

- **Rate-limit blok uygulamıyor** — `functions/src/sos.ts:493` `sosBlockedUntil` yazılıyor ama bir sonraki çağrıda okunup early-return yapılmıyor → SOS spam mümkün, "kurt geldi" etkisi.
- **112 entegrasyonu yok, kullanıcıya belirtilmiyor** — "112 ACİL ARA" sadece `tel:112` açıyor; SOS yetkililere otomatik gitmiyor. Kullanıcı gittiğini sanıp 112'yi ayrıca aramayabilir. → SOS aktifken kalıcı banner: *"Bu SOS yalnızca uygulamadaki kişilere iletildi. Resmi yardım için 112'yi arayın."*
- **Offline SOS "gönderildi" izlenimi** — tüm kanallar queued + mesh peer 0 iken kullanıcı iletildi sanıyor → kırmızı banner.
- **GPS (0,0) guard yok** — `SOSChannelRouter.ts`'de SOS sinyali (0,0) koordinatla gidebilir → ekip Atlantik'e yönlenir.
- **SOSModal countdown iptal butonu** — `SOSModal.tsx:369` X butonu yalnızca countdown'da görünür, aktif state'te kayboluyor → panikte iptal aranır bulunamaz.

### ■ P0-TEMA-8 — Compliance / store reject (KVKK + GDPR + Apple/Google)
**Uzmanlar:** Privacy, iOS · **Efor: M**

- **iOS ATT / Firebase Analytics IDFA** — `NSUserTrackingUsageDescription` yok, `firebase.json`'da analytics collection kapatılmamış → App Store binary scan reject (Guideline 5.1.2). En basit fix: `firebase.json` → `analytics_auto_collection_enabled: false`.
- **Privacy Manifest eksik beyan** — `PrivacyInfo.xcprivacy`'de sağlık verisi (`NSPrivacyCollectedDataTypeHealthAndFitness`) beyan yok → kan grubu/alerji topluyor → reject (ITMS-91053).
- **COPPA yaş kapısı yok** — onboarding'de yaş beyanı yok → 13 yaş altı veri toplama riski.
- **GDPR veri export yok** — Art. 15 "verilerimin kopyası" in-app desteklenmiyor (KVKK Madde 11 de aynı).
- **AI prompt → LLM, DPA + consent yok** — kullanıcı mesajları OpenAI'ye gidiyor; DPA imzasız, privacy policy açıklamıyor, consent banner yok.
- **Sentry/Crashlytics DPA** — (aşağıdaki çelişki notuna bakın — paket kurulu değil).

### ■ P0-TEMA-9 — App stabilite / mimari (CRASH + DONMA + LEAK)
**Uzmanlar:** RN/Expo, Performance · **Efor: M**

- **authStore subscribe döngüsü** — `authStore.ts:648` subscribe callback içinde `setState` → logout↔guard sonsuz döngü riski; aynı pattern `onboardingStore.ts:58`. → `prevState` karşılaştırması ekle.
- **App.tsx retry safety timer eksik** — `App.tsx:300` retry path'inde `initSafetyTimerRef` set edilmiyor → retry askıda kalırsa `appInitializingRef` sonsuza `true`, servisler hiç başlamaz.
- **init.ts 10 servis `any` tipli** — `init.ts:17` shutdown'da tip güvencesi yok → BLE/konum listener'ları temizlenmeden açık kalabilir.
- **SSE streaming abort leak** — `LocalAIAssistantScreen.tsx:225` unmount'ta `AbortController.abort()` yok → her ekran çıkışında açık bağlantı + unmounted setState.
- **ConversationScreen full-state subscription** — `ConversationScreen.tsx:256` tüm `messageStore.messages`'a abone → 500+ mesajda her mesajda jank. `getPagedMessages` selector zaten var.

### ■ P0-TEMA-10 — Test boşlukları (REGRESYON KÖRLÜĞÜ)
**Uzmanlar:** QA · **Efor: M**

40+ dosya değişti, kritik servislerde **sıfır test**:
- `VoiceCallService.ts` (808 satır) — WebRTC signaling
- `MultiSourceEEWService.ts` (715 satır) — multi-source fusion
- `AccountDeletionService.ts` (1034 satır) — silme cascade (Apple 5.1.1 riski)
- E2E ortamı kırık — `reports/e2e-report.md`'de 13 env "missing", Detox CI'da Firebase'e bağlanamıyor.

### ■ P0-TEMA-11 — Release prosedürü
**Uzmanlar:** Release · **Efor: S**

- `eas.json` `submit.production`'da **Android profili yok** → `eas submit -p android` çalışmaz.
- `docs/RELEASE_CHECKLIST.md` hâlâ **v1.6.2 referansları** içeriyor (tag + What's New) → yanlış tag/metin riski.
- 40+ staged değişiklik commit edilmemiş → CI görmeden EAS build = karışık state.

---

## 3. ÇELİŞKİLER & DOĞRULANAN BULGULAR

Audit sırasında ajanlar arası 3 çelişki çıktı; üçü de doğrulandı:

1. **Crash reporting** — Release ajanı "Sentry yok" dedi, Privacy ajanı "SentryService var" dedi.
   **DOĞRULANDI:** `@sentry/react-native` **kurulu değil** (`node_modules/@sentry` yok, `package.json`'da yok). `SentryService.ts` bilinçli bir **no-op adapter** — paket kuruluysa çalışır, değilse sessiz geçer. `crashlytics` paketi de yok.
   **SONUÇ:** Production'da **gerçek remote crash görünürlüğü yok**. Acil durum uygulaması için kör uçuş. → Firebase Crashlytics ekle (zaten Firebase var, MIT, sıfır maliyet). **P1 → P0'a yükseltilmeli.**

2. **iOS Critical Alert** — **DOĞRULANDI:** entitlements dosyasında yok. P0-TEMA-2.

3. **Android foreground service** — **DOĞRULANDI:** `AndroidManifest.xml`'de hiç `<service>`/`foregroundServiceType` yok. P0-TEMA-1.

---

## 4. P1 — BU SÜRÜMDE FİX ÖNERİLEN (özet)

| # | Bulgu | Uzman | Dosya | Efor |
|---|---|---|---|---|
| P1-1 | Crash reporting yok (yukarıdaki çelişki — P0'a yükselt) | Release | package.json | M |
| P1-2 | AI Streaming feature flag yok — rollback = store re-submission | Release | app.config.ts | M |
| P1-3 | OTA hotfix kapasitesi sıfır (EAS Update kaldırıldı) — expedited review şablonu hazırla | Release | eas.json | S |
| P1-4 | ProGuard'da WebRTC + BLE keep rule yok → release'de sessizce çalışmaz | Android | proguard-rules.pro | S |
| P1-5 | `USE_FULL_SCREEN_INTENT` izni yok → SOS/EEW lock screen'i geçemez | Android | AndroidManifest.xml | S |
| P1-6 | Firestore family-link tek-yönlü accepted = mutual sayılıyor | Database | firestore.rules:67 | M |
| P1-7 | RTDB presence tüm kullanıcılara açık | Database | database.rules.json:7 | S |
| P1-8 | `eew_pwave_detections` composite index — P-wave crowdsource çalışmıyor olabilir | Backend/DB | firestore.indexes.json | S |
| P1-9 | BLE replay koruması session-level, timestamp eşiği yok | Güvenlik | MeshNetworkService.ts:2357 | S |
| P1-10 | Hesap silme `deviceId` bazlı ama veri `uid`'de olabilir → veri kalır | Güvenlik/QA | AccountDeletionService.ts | M |
| P1-11 | Cert pinning yok (Firebase/AFAD/Kandilli) | Güvenlik | Info.plist | L |
| P1-12 | EditMemberModal Türkçe karakter bozuk ("Uyeyi Duzenle") | UX | EditMemberModal.tsx:137 | S |
| P1-13 | Onboarding izin sırası — gerekçe (priming) önce gelmeli | UX | OnboardingScreen.tsx | M |
| P1-14 | BLE continuous scan `allowDuplicates:true`, duty cycle yok → %60-96 ek batarya | Performance | HighPerformanceBle.ts:709 | M |
| P1-15 | Asset bundle ~128MB sıkıştırılmamış görsel → IPA şişkin | Performance | assets/images/premium/ | S |
| P1-16 | 81 Firestore `onSnapshot` — unsubscribe pattern dağınık | Performance | (çeşitli) | M |
| P1-17 | KVKK Aydınlatma Metni yok (ToS ≠ Aydınlatma Metni) | Privacy | privacy-policy.html | M |
| P1-18 | Background konum minimization yok (paylaşım kapalıyken bile çalışır) | Privacy | useLiveLocation.ts | M |
| P1-19 | Analytics consent/opt-out yok, default açık | Privacy | FirebaseAnalyticsService.ts:98 | S |
| P1-20 | SMTP credentials `process.env`, Secret Manager yok | Backend | admin.ts:35 | M |
| P1-21 | SOS broadcast fan-out pagination yok (`limit(10000)`) | Backend | sos.ts:506 | M |
| P1-22 | EEW AI tahmin vs resmi uyarı UI ayrımı kodda zorunlu değil | Safety/UX | WaveVisualizationScreen.tsx | S |
| P1-23 | SOS 5sn countdown — cep (pocket) yanlış tetikleme riski | Safety | SOSStateManager.ts:174 | S |
| P1-24 | iOS `buildNumber` "6" çok düşük — App Store Connect çakışması riski | iOS | app.config.ts:179 | S |
| P1-25 | Detox E2E ortamı kırık (CI'da çalışmıyor) | QA | e2e/ | L |

---

## 5. P2 / P3 — SONRAKİ SÜRÜM (tematik özet)

- **Native temizlik:** Android legacy BLE permission guard (`maxSdkVersion=30`), `WRITE_SETTINGS`/`SYSTEM_ALERT_WINDOW` release'ten çıkar, `READ/WRITE_EXTERNAL_STORAGE` deprecate; iOS `NSBluetoothPeripheralUsageDescription` deprecated key, `LSApplicationQueriesSchemes`'tan `http/https` çıkar; Privacy Manifest disk-space reason düzelt.
- **Database sağlamlaştırma:** `seismicDetections` immutable yap, `voice_calls` ICE candidate boyut/write sınırı, `news_summary_jobs` lease bypass, `plum_observations` userId zorunlu, Storage `maps/` public read kapat.
- **Performance:** `init.ts` 18 servis paralel yükleme → fazlandır; çift GPS watcher (FamilyTracking+LocationService); web Firebase SDK + native Firebase SDK çift bundle; WaveScreen animated listener JS-thread setState.
- **UX:** offline harita yok, harita clustering, NotificationSettings 35-kombinasyon karmaşıklığı, EditMemberModal unsaved-changes uyarısı, dark mode, SOSHelpScreen sticky bottom bar, FamilyStatusSection empty state, a11y label'lar (SOSHelpScreen accessibilityLabel sıfır).
- **Safety/Ürün (v1.7 kapsam):** çok dilli destek (Arapça — mülteci nüfus; kod içinde `i18nService` TODO'su var), sahte SOS bildirme mekanizması, BLE device ID rotation (stalkerware vektörü), aile-takip domestic-abuse disclaimer, Volunteer modülü statik/hardcoded (gerçek veri ya da UI'den kaldır), kayıp/bulunan kişi bildirimi, crowdsourced sismik ağ (opt-in).
- **Backend:** in-memory rate-limit map multi-instance'da etkisiz, `locationHistoryCleanup` 500-doc limiti retention'ı kıramıyor, USGS/EMSC parser null-check.

---

## 6. ÖNERİLEN AKSİYON PLANI

### Faz 0 — BUGÜN (lead-time başlat)
1. **Apple Critical Alerts capability başvurusu** (P0-TEMA-2) — 1-4 hafta sürer, beklerken her şey paralel.
2. **Üçüncü taraf DPA süreçleri başlat** — OpenAI (enterprise), Sentry/Crashlytics. İmza haftalar alır.

### Faz 1 — Crash & store blocker (1-2 gün) — *bunlar olmadan build bile alma*
- P0-TEMA-1: Android `<service>`/`foregroundServiceType` + iOS `audio`/`voip` background mode
- P0-TEMA-8 (kısmi): `firebase.json` analytics kapat (ATT), Privacy Manifest sağlık beyanı
- P0-TEMA-11: `eas.json` Android submit profili, RELEASE_CHECKLIST v1.6.3
- Çelişki #1: Firebase Crashlytics paketi ekle
- P0-TEMA-9: authStore döngü guard, App.tsx retry timer, SSE abort

### Faz 2 — Exploit & veri sızıntısı (2-3 gün)
- P0-TEMA-3: backend auth gate + timing oracle + CORS
- P0-TEMA-4: Firestore `users` list / `families` / `devices` rule'ları
- P0-TEMA-6: MMKV encryption
- P0-TEMA-5: BLE broadcast — kısa vade broadcast kapat, P2P şifreli zorla

### Faz 3 — SOS doğruluk & test (2-3 gün)
- P0-TEMA-7: rate-limit blok, 112 banner, offline banner, GPS (0,0) guard, countdown iptal butonu
- P0-TEMA-10: VoiceCall + MultiSourceEEW + AccountDeletion testleri, E2E ortamı

### Faz 4 — Compliance tamamla (2-4 gün, DPA hariç)
- P0-TEMA-8: COPPA yaş kapısı, GDPR veri export, AI consent banner, KVKK Aydınlatma Metni

### Faz 5 — Regresyon & yayın
- 40+ değişikliği commit → CI yeşil → EAS build → TestFlight/Internal testing
- Cihaz smoke testi (RELEASE_CHECKLIST güncel haliyle) → staged rollout %10→%50→%100

---

## 7. EFOR TAHMİNİ

| Faz | İçerik | En iyi | En kötü |
|---|---|---|---|
| Faz 1 | Crash & store blocker | 1 gün | 2 gün |
| Faz 2 | Exploit & sızıntı | 2 gün | 3 gün |
| Faz 3 | SOS & test | 1.5 gün | 3 gün |
| Faz 4 | Compliance | 2 gün | 4 gün |
| **Toplam (P0)** | | **~6.5 iş günü** | **~12 iş günü** |

> **Apple Critical Alerts başvurusu** (1-4 hafta) yukarıdaki sürelere **paralel** yürür. Entitlement onayı gelmeden de yayınlanabilir — ancak o sürümde EEW kritik-alert garanti edilemez ve Marketing'de vadedilmemeli.

> **BLE broadcast yeniden tasarımı** (P0-TEMA-5 tam çözüm, efor L) Faz 2'de "kısa vade kapatma" ile blocker'dan çıkarılır; tam ECDH çözümü v1.6.4'e planlanabilir.

---

## 8. UZMAN BAZLI GO/NO-GO ÖZETİ

| Uzman | Karar | Tek cümlelik gerekçe |
|---|---|---|
| iOS Native | CONDITIONAL NO-GO | ATT + audio mode + Critical Alert başvurusu kapanmadan reject riski |
| Android Native | CONDITIONAL NO-GO | `foregroundServiceType` eksik → Android 14 kesin crash |
| Backend | NO-GO | Sahte raporla ulusal EEW + timing oracle gerçek exploit |
| Database | CONDITIONAL GO | Fail-closed var ama `users` list leak + device hijack aktif risk |
| Mobil Güvenlik | CONDITIONAL NO-GO | BLE broadcast key-in-payload + MMKV şifresiz |
| Performance | CONDITIONAL GO | SSE leak + ConversationScreen jank hotfix gerek, blocker değil |
| RN/Expo Mimari | CONDITIONAL GO | authStore döngü + retry timer hızlı S-fix |
| UX | CONDITIONAL GO | Lock-screen EEW native config'e bağlı, Türkçe karakter acil |
| QA | CONDITIONAL NO-GO | Kritik 3 serviste sıfır test + E2E ortamı kırık |
| Privacy/KVKK | CONDITIONAL NO-GO | COPPA + AI DPA + Sentry Privacy Manifest store reject riski |
| Safety Ops | CONDITIONAL GO | Rate-limit blok + 112 banner yayın öncesi şart |
| Ürün | GO (v1.6) | Core işlevsel; v1.7 kapsam (çok dil, kayıp kişi) gerekli |

---

*Rapor: Elite Team 12-uzman paralel audit · AfetNet v1.6.3 · 2026-05-20*
