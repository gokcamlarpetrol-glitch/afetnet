# AfetNet v1.6.3 — ULTRA PLAN (Sıfır-Hata Yayın Planı)

> **Amaç:** 12-uzman audit'inde (`reports/AUDIT-v1.6.3.md`) çıkan tüm bulguları,
> hayati bir afet uygulamasının gerektirdiği **sıfır-hata, dünya-standardı**
> kalitede kapatmak.
> **Kapsam:** ~40 P0 (11 tema) + ~35 P1 + ~40 P2/P3.
> **İlke:** Her iş paketi (WP) bağımsız doğrulanabilir, geri alınabilir ve
> bir "Definition of Done" (DoD) ile kapanır. DoD geçmeden WP kapanmaz.

---

## 0. SIFIR-HATA METODOLOJİSİ

### 0.1 Her WP için zorunlu Definition of Done
Bir WP "bitti" sayılmaz — şu 7 madde yeşil olmadıkça:
1. `npx tsc --noEmit` → **0 hata**
2. `npx eslint src --max-warnings 0` → **0 uyarı**
3. `npm test` (etkilenen testler) → **0 başarısız**
4. Değişen davranış için **yeni test yazıldı** (yoksa WP eksik)
5. Native değişiklik varsa → **build alındı + gerçek cihazda doğrulandı**
6. Regresyon riski olan alanda → **smoke test yapıldı** (RELEASE_CHECKLIST)
7. Kod review (`/review` veya `/senior-reviewer`) → onaylı

### 0.2 Faz quality gate'leri
Her faz sonunda — bir sonraki faza geçmeden:
- `npm run preflight` (typecheck + lint + test + versiyon senkron) → **exit 0**
- Faz boyunca değişen tüm dosyalar tek mantıksal commit grubu
- Native build gerektiren fazlarda → EAS build + TestFlight/Internal smoke

### 0.3 Branch & PR stratejisi
- Faz başına bir feature branch: `release/v1.6.3-faz1` ... `faz6`
- WP başına bir commit (Conventional Commits, İngilizce)
- Her faz sonunda `main`'e PR → CI yeşil → merge
- **Native rebuild gerektiren WP'ler tek faza toplanır** (Faz 1) — tek `expo prebuild`, tek build cycle

### 0.4 Geri alma (rollback) ilkesi
- EAS Update kaldırıldığı için OTA hotfix **yok** → her faz bağımsız test edilmeli
- Apple expedited review şablonu Faz 0'da hazırlanır (kamu güvenliği gerekçesi)
- Backend (Cloud Functions) değişiklikleri mobilden **bağımsız** deploy edilebilir → exploit fix'leri öne çekilir
- Firestore rules: her değişiklik `firebase emulators` + rules unit test ile doğrulanır, sonra deploy

### 0.5 Efor lejantı
**S** = <4 saat · **M** = 1-2 gün · **L** = 3-5 gün · **XL** = 1+ hafta

---

## 1. GLOBAL BAĞIMLILIKLAR & ÖN-KOŞULLAR

Bunlar planın "sıfır hata" iddiasının dayanağıdır — atlanırsa kullanıcı verisi/güveni kaybedilir.

| # | Bağımlılık | Etki | Çözüm |
|---|---|---|---|
| G1 | **Native rebuild gruplanması** | WP-1.1/1.2/1.4/1.5 + WP-5.1/5.2/5.12 hepsi `expo prebuild` ister | Hepsi Faz 1+5 içinde toplanır, **tek prebuild** sonra tek build |
| G2 | **MMKV şifreleme migration** | `encryptionKey` eklenince eski şifresiz veri okunamaz → tüm yayındaki kullanıcı auth/onboarding state kaybeder | WP-2.5 `recrypt()` migration adımı — eski instance aç, recrypt, doğrula |
| G3 | **Firestore rules deploy sırası** | Rules sıkılaşırsa eski client (yayındaki v1.6.2) kırılabilir | Rules **geriye uyumlu** yazılır; client list query taraması yapıldı (`users` temiz); deploy emulator-test sonrası |
| G4 | **Server-mobile version drift** | Backend fix'leri (Faz 2) mobilden önce deploy edilirse eski client yeni davranışla karşılaşır | Backend değişiklikleri geriye uyumlu; breaking olanlar mobil build ile senkron |
| G5 | **VoiceCall kaldırılıyor** | Kullanıcı kararı: canlı sesli arama özelliği tamamen sökülüyor (WP-1.2) | `voip`/`microphone` beyanı GEREKMEZ; `react-native-webrtc` bağımlılığı da kaldırılır |

> **KARAR VERİLDİ:** VoiceCall (canlı sesli arama / WebRTC) özelliği bu
> sürümde **tamamen kaldırılıyor** (WP-1.2). Ses mesajı (VoiceMessage) AYRI
> bir özelliktir ve korunur. `react-native-webrtc` bağımlılığı da sökülür —
> native binary küçülür, ProGuard WebRTC keep-rule'u gereksizleşir, iOS
> `voip` + Android `microphone` foreground service beyanı gerekmez.

---

## FAZ 0 — LEAD-TIME (BUGÜN BAŞLAT, paralel yürür)

Bu fazın işleri haftalar sürer; tüm diğer fazlar bunları beklemez.

#### WP-0.1 — Apple Critical Alerts capability başvurusu
- **Kaynak:** P0-TEMA-2
- **Hedef:** EEW/SOS bildiriminin sessiz mod + DND'yi aşması (entitlement Apple onayı gerektirir)
- **Adımlar:**
  1. Apple Developer Portal → Certificates, IDs & Profiles → App ID → Critical Alerts
  2. Gerekçe metni: "Earthquake Early Warning — saniyeler hayat kurtarır; AFAD/Kandilli kaynaklı resmi sismik uyarı"
  3. Onay sonrası WP-1.x içinde entitlement + provisioning profile güncellenir
- **Bağımlılık:** Yok — ilk iş
- **DoD:** Başvuru gönderildi, takip numarası kaydedildi
- **Efor:** S (başvuru) + 1-4 hafta Apple bekleme

#### WP-0.2 — Üçüncü taraf DPA süreçleri
- **Kaynak:** P0-TEMA-8 (Privacy P0-3, P0-4)
- **Hedef:** OpenAI/Anthropic + Crashlytics için GDPR Art. 28 veri işleme sözleşmesi
- **Adımlar:**
  1. OpenAI: enterprise/platform DPA başvurusu (AI proxy kullanıyorsa)
  2. Firebase DPA: zaten Google ile var — Crashlytics kapsamını doğrula
  3. KVKK VERBİS kaydı durumunu kontrol et (veri sorumlusu sicili)
- **DoD:** DPA'lar imza sürecinde, privacy policy taslağı hukuk onayında
- **Efor:** S (başlatma) + haftalar (imza)

#### WP-0.3 — Hotfix SLA & expedited review hazırlığı
- **Kaynak:** Audit P1-3
- **Adımlar:** Apple expedited review e-posta şablonu hazırla; Play Console "halt rollout" prosedürünü `RELEASE_CHECKLIST`'e ekle
- **DoD:** Şablon + prosedür dokümante
- **Efor:** S

---

## FAZ 1 — CRASH & STORE BLOCKER (en iyi 1g / en kötü 2g)

> Hedef: Build alınabilir + store'a girebilir hale gelmek. **Bu faz bitmeden EAS build alma.**

#### WP-1.1 — Native servis & background mode beyanları
- **Kaynak:** P0-TEMA-1 (Android P0-1, Release P0-3, iOS P0-3)
- **Hedef:** Android 14 crash'i ve iOS Guideline 2.5.4 reject'i kapatmak
- **Dosyalar:** `android/app/src/main/AndroidManifest.xml`, `app.config.ts`, (prebuild sonrası) `ios/.../Info.plist`
- **Adımlar:**
  1. AndroidManifest'e açık `<service>` declaration'ları ekle:
     - Konum servisi → `android:foregroundServiceType="location"`
     - BLE mesh/peripheral → `"connectedDevice"`
  2. `app.config.ts` android.permissions → `FOREGROUND_SERVICE_LOCATION`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`
  3. `expo prebuild --clean` (G1 — diğer native WP'lerle birlikte tek sefer)
- **Bağımlılık:** WP-1.2 (VoiceCall kaldırıldıktan SONRA — `voip`/`microphone`/`audio` beyanı gerekmez)
- **DoD:** Android 14 cihazda FamilyTracking/BLE foreground servisi crash'siz başlar; `verify:native-config` PASS
- **Regresyon riski:** Yanlış foregroundServiceType → servis başlamaz. Azaltma: her servis tipini ayrı cihaz testiyle doğrula
- **Efor:** M

#### WP-1.2 — VoiceCall özelliğini tamamen kaldır
- **Kaynak:** P0-TEMA-1, Release P0-4, G5 (kullanıcı kararı)
- **Hedef:** Canlı sesli arama (WebRTC) özelliğini ve tüm bağımlılıklarını sökmek. **VoiceMessage (ses mesajı) korunur — ayrı özellik.**
- **Silinecek:** `src/core/services/VoiceCallService.ts`, `src/core/screens/messages/VoiceCallScreen.tsx`, `src/core/components/IncomingCallOverlay.tsx`, `functions/src/voice.ts`
- **Düzenlenecek:** `init.ts` (init+cleanup blokları), `navigation.ts` + `navigationRef.ts` + `MainNavigator.tsx` (route), `ChatHeader.tsx` (arama butonu), `NotificationCenter.ts` (call notification), `functions/src/index.ts` (voice exports 73-74), `functions/src/utils.ts` (voice ref), `package.json` (`react-native-webrtc` + expo doctor exclude), `firestore.rules` (`voice_calls`/`voice_calls_incoming`/candidate subcollection'ları), `firestore.indexes.json` (voice index varsa)
- **Adımlar:**
  1. UI giriş noktalarını kaldır (ChatHeader arama butonu, VoiceCallScreen route, IncomingCallOverlay)
  2. `init.ts` VoiceCall init+cleanup bloklarını sil
  3. Servis + ekran + overlay + CF dosyalarını sil
  4. `firestore.rules` voice collection rule'larını sil → rules unit test
  5. `react-native-webrtc` paketini kaldır (`npm uninstall`) — yalnızca VoiceCall kullanıyordu
  6. CF: `voice` export'larını kaldır, `firebase deploy --only functions` ile `onIncomingVoiceCall`+`sendCallNotification` silinir
- **Bağımlılık:** Faz 1'in ilk WP'si — WP-1.1 native beyanlar buna bağlı
- **DoD:** `grep -rn "VoiceCall\|voiceCall\|react-native-webrtc"` → 0 sonuç (VoiceMessage hariç); `tsc` 0 hata; uygulama derlenir; mesaj ekranı arama butonsuz çalışır
- **Regresyon riski:** ChatHeader/navigation kırılabilir → mesaj akışı smoke testi. WebRTC kaldırılınca başka import kalmamalı (grep ile teyit edildi: tek kullanıcı VoiceCallService)
- **Efor:** M

#### WP-1.3 — Firebase Analytics IDFA kapatma (ATT)
- **Kaynak:** iOS P0-2
- **Dosyalar:** `firebase.json`
- **Adımlar:** `firebase.json`'a `"analytics_auto_collection_enabled": false` + `"app_data_collection_default_enabled": false`. Analytics WP-4.5'te consent'e bağlı opt-in olacak
- **DoD:** App Store binary scan'de IDFA erişimi yok; ATT prompt gerekmez
- **Efor:** S

#### WP-1.4 — Privacy Manifest tamamlama
- **Kaynak:** Privacy P3-3, iOS P2-7
- **Dosyalar:** `ios/AfetNetAcilletiim/PrivacyInfo.xcprivacy`
- **Adımlar:**
  1. `NSPrivacyCollectedDataTypeHealthAndFitness` ekle (`Linked: false`, purpose: AppFunctionality)
  2. Disk-space API reason'ı denetle → tek doğru reason bırak
  3. Crashlytics eklenince (WP-1.5) gerekli required-reason API'ları merge et
- **DoD:** Privacy Manifest gerçek toplanan veriyle birebir; ITMS-91053 riski yok
- **Efor:** S

#### WP-1.5 — Firebase Crashlytics entegrasyonu
- **Kaynak:** Audit Çelişki #1 (P1→P0 yükseltildi)
- **Hedef:** Production'da remote crash görünürlüğü (şu an `SentryService` no-op)
- **Dosyalar:** `package.json`, `app.config.ts`, `src/core/services/FirebaseCrashlyticsService.ts`, `init.ts`
- **Adımlar:**
  1. `npx expo install @react-native-firebase/crashlytics` (MIT, Firebase zaten var — `/audit-deps` ile teyit)
  2. `FirebaseCrashlyticsService.ts`'i gerçek SDK'ya bağla (şu an muhtemelen stub)
  3. EAS build'de dSYM (iOS) + R8 mapping (Android) upload otomatik
  4. PII redaction: crash breadcrumb'larda phone/email/health/content **yok** — doğrula
- **Bağımlılık:** WP-0.2 (Crashlytics DPA kapsamı)
- **DoD:** Test crash → Firebase Console'da symbolicated görünür; PII sızıntısı yok
- **Regresyon riski:** Native rebuild gerekir (G1) → WP-1.1 prebuild'ine dahil
- **Efor:** M

#### WP-1.6 — App stabilite fix'leri (crash/donma/leak)
- **Kaynak:** P0-TEMA-9 (RN P0-1/2/3, Perf P0-3)
- **Dosyalar:** `authStore.ts:648`, `onboardingStore.ts:58`, `App.tsx:300`, `init.ts:17`, `LocalAIAssistantScreen.tsx:225`
- **Adımlar:**
  1. authStore/onboardingStore subscribe guard'ına `prevState` karşılaştırması — değişmediyse `setState` çağırma (sonsuz döngü fix)
  2. `App.tsx` retry path'ine `initSafetyTimerRef` set et (askıda kalma fix)
  3. `init.ts` 10 servis `any` → minimal `StoppableService`/`CleanupService` interface
  4. `LocalAIAssistantScreen` SSE'ye `AbortController` + `useEffect` cleanup'ta `abort()`
- **DoD:** authStore döngü testi yeşil; retry simülasyonu servisleri başlatır; SSE ekran çıkışında bağlantı kapanır (network inspector ile doğrula)
- **Regresyon riski:** Auth state geçişleri hassas → `onboardingAuthPersistence.test.ts` + manuel login/logout/onboarding smoke
- **Efor:** M

#### WP-1.7 — Release prosedürü düzeltme
- **Kaynak:** P0-TEMA-11 (Release P0-1, P0-2)
- **Dosyalar:** `eas.json`, `docs/RELEASE_CHECKLIST.md`
- **Adımlar:**
  1. `eas.json` `submit.production` → `"android": { "track": "internal" }` + iOS `"distribution": "store"`
  2. `RELEASE_CHECKLIST.md` tüm `v1.6.2` → `v1.6.3`; What's New metni v1.6.3 değişikliklerine göre
  3. Staged rollout adımları ekle (App Store phased %5→%100, Play %10→%100)
- **DoD:** `eas submit` her iki platformda config-complete; checklist v1.6.3
- **Efor:** S

### ▸ FAZ 1 QUALITY GATE
`npm run preflight` exit 0 · `expo prebuild` temiz · EAS build (her iki platform) başarılı · TestFlight + Play Internal'a yüklendi · Android 14 + iOS gerçek cihazda **açılış crash'siz**

---

## FAZ 2 — EXPLOIT & VERİ SIZINTISI (en iyi 2g / en kötü 3g)

> Backend WP'leri mobilden bağımsız deploy edilebilir → exploit'ler hemen kapanır.

#### WP-2.1 — Backend auth gate'leri
- **Kaynak:** P0-TEMA-3 (Backend P0-1), Database P2-2
- **Hedef:** Sahte sismik raporla ulusal EEW tetiklenmesini engellemek
- **Dosyalar:** `database.rules.json`, `functions/src/admin.ts:834`, `firestore.rules` (plum_observations)
- **Adımlar:**
  1. RTDB rules: `seismic_reports` write → `auth != null`, `userId === auth.uid`
  2. `onSeismicReportCreated` → `report.userId` yoksa düşür, `'unknown'` altında toplama
  3. `firestore.rules` `plum_observations` create → `userId == request.auth.uid` zorunlu
  4. Sybil dedup'ı server-side UID'e dayandır (client field'a değil)
- **Bağımlılık:** Yok — ilk deploy edilecek
- **DoD:** Emulator'da auth'suz `seismic_reports` write reddedilir; rules unit test yeşil
- **Regresyon riski:** Meşru anonim rapor varsa kırılır → kullanım analizi: tüm rapor akışları authenticated mı doğrula
- **Efor:** M

#### WP-2.2 — eewWebhook timing oracle + CORS
- **Kaynak:** P0-TEMA-3 (Backend P0-2, P0-3)
- **Dosyalar:** `functions/src/eew.ts:1224,1445`, `functions/src/admin.ts:419`
- **Adımlar:**
  1. API key uzunluk kontrolünü kaldır; sadece `crypto.timingSafeEqual` (eşit uzunluk için sabit-boyut buffer'a pad)
  2. `openAIChatProxy` `!reqOrigin` → wildcard CORS kaldır; auth zaten ID token ile
- **DoD:** Uzunluk oracle'ı yok; CORS sadece bilinen origin/no-origin'de Content-Type
- **Efor:** S

#### WP-2.3 — Firestore rules: kritik açıklar
- **Kaynak:** P0-TEMA-4 (DB P0-1, P0-2, P1-1)
- **Dosyalar:** `firestore.rules:735` (users), `:1057` (families), `:406` (devices)
- **Adımlar:**
  1. `users`: `allow get: if isAuthenticated()` / `allow list: if isAdmin()` ayır (client list query yok — doğrulandı, güvenli)
  2. `families` update: `affectedKeys().hasOnly([...])` + `members`/`createdBy` değişimini `createdBy == auth.uid`'e kilitle
  3. `devices` "migration-safe claim" rule'unu kaldır → migration tek-sefer admin CF ile
- **Bağımlılık:** G3 — emulator test + client `families`/`devices` write pattern taraması
- **DoD:** Rules unit test: user list reddi, family hijack reddi, device claim reddi yeşil
- **Regresyon riski:** Meşru family update kırılabilir → `affectedKeys` whitelist'i gerçek client write'larıyla eşleştir
- **Efor:** M

#### WP-2.4 — Firestore rules: ikincil sızıntılar
- **Kaynak:** DB P1-5, P2-4/5/6, P3-4
- **Adımlar:** RTDB presence → owner-only; `voice_calls` ICE candidate boyut+`create`-only; `seismicDetections` → immutable; `news_summary_jobs` lease `affectedKeys` guard; RTDB `rate_limits` → `write: false`
- **DoD:** İlgili rules unit testleri yeşil
- **Efor:** M

#### WP-2.5 — MMKV şifreleme + migration
- **Kaynak:** P0-TEMA-6 (Security P0-1, P0-2, P0-10), G2
- **Hedef:** Kimlik+sağlık+kripto verisini şifrelemek — **mevcut kullanıcı verisini kaybetmeden**
- **Dosyalar:** `src/core/utils/storage.ts:144`, `CryptoService.ts:113`
- **Adımlar:**
  1. SecureStore'da `afetnet_mmkv_key` ara; yoksa `nacl.randomBytes(32)` üret, SecureStore'a yaz
  2. **Migration:** önce `new MMKV({ id: 'afetnet-storage-v2' })` (şifresiz, eski veri), sonra `instance.recrypt(key)` → veri yerinde şifrelenir, kayıp yok
  3. Sonraki açılışlarda `new MMKV({ id, encryptionKey })`
  4. Migration tamamlandı flag'i (SecureStore) — idempotent
  5. CryptoService: SecureStore yoksa private key'i **düz yazma** → E2EE'yi başlatma, kullanıcıyı uyar
- **Bağımlılık:** G2 — bu adım atlanırsa tüm yayındaki kullanıcılar state kaybeder
- **DoD:** v1.6.2 verisiyle dolu cihazda v1.6.3'e güncelleme → auth/onboarding/ayarlar **korunur**; veri artık şifreli (cihaz dosya inceleme ile teyit)
- **Regresyon riski:** **YÜKSEK** — yanlış migration tüm kullanıcıyı logout eder. Azaltma: v1.6.2 build'den upgrade senaryosunu fiziksel cihazda test et (zorunlu)
- **Efor:** M

#### WP-2.6 — BLE broadcast şifreleme (kısa-vade güvenli mod)
- **Kaynak:** P0-TEMA-5 (Security P0-4)
- **Hedef:** Mesh SOS/sağlık verisinin pasif dinlenmesini engellemek
- **Dosyalar:** `MeshCryptoService.ts:417`, `MeshNetworkService.ts:603`
- **Adımlar (kısa vade — bu sürüm):**
  1. `encryptBroadcast`'te key-in-payload'u kaldır
  2. Broadcast'i yalnızca P2P şifreli `sendToPeer` (ECDH oturum anahtarı) ile sınırla
  3. Alıcısı bilinmeyen broadcast → gönderme (sessiz drop yerine logla)
- **Tam çözüm (v1.6.4):** Broadcast için ayrı ECDH key-exchange — ayrı WP, efor L
- **DoD:** Mesh paketi BLE sniffer ile yakalanıp düz metin çözülemiyor; P2P mesaj hâlâ çalışıyor
- **Regresyon riski:** Broadcast tabanlı keşif kırılabilir → mesh peer discovery'nin broadcast'e bağımlı olmadığını doğrula
- **Efor:** M

#### WP-2.7 — Sağlık paylaşımı gated fallback
- **Kaynak:** P0-TEMA-5 (Safety P0-D)
- **Dosyalar:** `EmergencyHealthSharingService.ts:376`, `MeshNetworkService.ts` (broadcastPacket)
- **Adımlar:** `broadcastPacket` içinde `gated === true && !recipientIds?.length` → throw; client fallback'i `sendToPeer` zorunlu yapacak şekilde sıkılaştır
- **DoD:** Test: `sendToPeer` yok + gated → sağlık verisi **gönderilmez** (fail-closed), exception loglanır
- **Efor:** M

### ▸ FAZ 2 QUALITY GATE
`npm run preflight` exit 0 · Firestore rules unit test suite yeşil · backend functions deploy (staging) + emulator exploit denemeleri reddedildi · MMKV upgrade senaryosu fiziksel cihazda doğrulandı

---

## FAZ 3 — SOS DOĞRULUK & TEST ALTYAPISI (en iyi 1.5g / en kötü 3g)

#### WP-3.1 — SOS rate-limit blok uygulama
- **Kaynak:** P0-TEMA-7 (Safety P0-A)
- **Dosyalar:** `functions/src/sos.ts:493`
- **Adımlar:** `onSOSBroadcast` girişinde `rate_limits/{uid}.sosBlockedUntil` oku → `Date.now() < blockedUntil` ise `return null`; `runTransaction` ile race-safe
- **DoD:** Test: blok süresinde ikinci SOS işlenmez; meşru SOS (blok yok) geçer
- **Regresyon riski:** Meşru ardışık SOS engellenebilir → blok penceresi makul (örn. 30sn), gerçek acil tekrarı düşünülerek ayarla
- **Efor:** S

#### WP-3.2 — SOS dürüstlük banner'ları
- **Kaynak:** P0-TEMA-7 (Safety P0-B, P0-C)
- **Dosyalar:** `SOSModal.tsx`, `SOSChannelRouter.ts`
- **Adımlar:**
  1. SOS aktifken kalıcı banner: *"Bu SOS yalnızca uygulamadaki kişilere iletildi. Resmi yardım için 112'yi arayın."*
  2. Tüm kanallar `queued/failed` + mesh peer 0 → kırmızı banner: *"Şu an kimseye ulaşılamıyor. Hemen 112 arayın."*
- **DoD:** Online/offline/no-peer üç senaryoda doğru banner; cihazda görsel doğrulama
- **Efor:** S

#### WP-3.3 — GPS (0,0) guard
- **Kaynak:** P0-TEMA-7 (QA P0-A)
- **Dosyalar:** `SOSChannelRouter.ts`, `BackendPushService.ts`
- **Adımlar:** SOS sinyali gönderilmeden `lat===0 && lng===0` (ve geçersiz aralık) guard → kullanıcıyı uyar, son bilinen konuma düş veya konum iste
- **DoD:** Test: (0,0) koordinatlı SOS gönderilmez, kullanıcı uyarılır
- **Efor:** S

#### WP-3.4 — SOSModal countdown iptal butonu
- **Kaynak:** P0-TEMA-7 (UX P0-4)
- **Dosyalar:** `SOSModal.tsx:369`
- **Adımlar:** İptal/STOP butonunu hem countdown hem active state'te sabit konumda, ekranın üst yarısında, scroll'suz göster
- **DoD:** Countdown + active her ikisinde iptal erişilebilir; cihazda doğrulandı
- **Efor:** S

#### WP-3.5 — Kritik servis test altyapısı
- **Kaynak:** P0-TEMA-10 (QA P0-B, P0-C, P0-D)
- **Dosyalar:** yeni `__tests__/VoiceCallService.test.ts`, `MultiSourceEEWService.test.ts`, `AccountDeletionService.test.ts`
- **Adımlar:**
  1. VoiceCall: offer-answer round-trip mock, ICE failure fallback, hangup state, WebRTC-unavailable graceful
  2. MultiSourceEEW: source merge, duplicate dedup, stale (>60s) filter, fallback proxy
  3. AccountDeletion: cascade sırası, partial-failure (network drop), `deviceId` vs `uid` (V3) kapsama tamlığı
- **DoD:** 3 servis için anlamlı coverage; `npm test` yeşil; `test:critical`'a eklendi
- **Efor:** M

#### WP-3.6 — E2E ortamı onarımı
- **Kaynak:** QA P1-25, P3-C
- **Dosyalar:** `e2e/`, CI secrets, `reports/e2e-report.md`
- **Adımlar:** Eksik 13 env'i EAS/CI secret olarak ekle; Detox'u CI'da çalıştır; privacy-policy/terms URL canlılığını healthcheck'e bağla
- **DoD:** Detox onboarding+SOS E2E CI'da yeşil koşuyor
- **Efor:** L

### ▸ FAZ 3 QUALITY GATE
`npm run preflight` exit 0 · SOS smoke (online/offline/no-peer) cihazda · 3 yeni test suite yeşil · E2E CI'da çalışıyor

---

## FAZ 4 — COMPLIANCE (en iyi 2g / en kötü 4g)

#### WP-4.1 — COPPA yaş kapısı
- **Kaynak:** P0-TEMA-8 (Privacy P0-1)
- **Dosyalar:** `OnboardingScreen.tsx`, kayıt akışı
- **Adımlar:** Kayıt/onboarding'e zorunlu "13 yaş ve üzerindeyim" onayı; reddederse devam etmez; consent timestamp + sürüm kaydet
- **DoD:** Yaş onayı olmadan onboarding tamamlanamaz; test yeşil
- **Efor:** S

#### WP-4.2 — GDPR/KVKK veri export
- **Kaynak:** P0-TEMA-8 (Privacy P0-2)
- **Dosyalar:** yeni Cloud Function `exportUserData`, Ayarlar→Gizlilik ekranı
- **Adımlar:** "Verilerimi İndir" → CF kullanıcının verisini (profil, konum geçmişi, sağlık özeti, mesaj metadata) JSON üretir → e-posta/indirme
- **Bağımlılık:** PII kapsamı Privacy ekibiyle netleştir
- **DoD:** Kullanıcı kendi verisini export edebiliyor; çıktı KVKK Md.11 / GDPR Art.15 kapsamını karşılıyor
- **Efor:** M

#### WP-4.3 — AI consent + DPA entegrasyonu
- **Kaynak:** P0-TEMA-8 (Privacy P0-3)
- **Dosyalar:** AI asistan ekranları, `OpenAIService.ts`, privacy policy
- **Adımlar:** AI ilk kullanımda consent banner ("mesajlarınız AI sağlayıcıya iletilir"); privacy policy'ye AI veri akışı paragrafı; WP-0.2 DPA'ya bağla
- **DoD:** Consent verilmeden AI prompt gönderilmez; policy güncel
- **Efor:** M

#### WP-4.4 — KVKK Aydınlatma Metni
- **Kaynak:** Audit P1-17
- **Adımlar:** Aydınlatma Metni belgesi (veri sorumlusu, amaç, alıcılar, saklama, haklar); onboarding son adıma ikinci link; veri sorumlusu e-postasını domain tabanlı yap (`kvkk@afetnet.app`)
- **DoD:** Aydınlatma Metni yayında ve onboarding'den erişilebilir
- **Efor:** M

#### WP-4.5 — Analytics consent + opt-out
- **Kaynak:** Audit P1-19
- **Dosyalar:** `FirebaseAnalyticsService.ts:98`, Ayarlar
- **Adımlar:** `initialize()`'ı `analyticsOptIn` flag'e bağla (varsayılan `false`); Ayarlar'da toggle
- **DoD:** Rıza olmadan analytics event gönderilmez
- **Efor:** S

#### WP-4.6 — Hesap silme cascade doğrulama + retention
- **Kaynak:** Audit P1-10, Privacy P1-5, P2-4
- **Dosyalar:** `AccountDeletionService.ts`, backup lifecycle
- **Adımlar:** `deviceId`-bazlı ve `uid`-bazlı (V3) silme yollarını gerçek veri modeline göre denetle; ölü çağrıları temizle; backup bucket'a 30-gün TTL; retention tablosu (`konum 30g, mesaj 1y, SOS 90g, crash 30g`) ToS'a + Firestore TTL'e
- **Bağımlılık:** WP-3.5 (AccountDeletion testi bu doğrulamayı destekler)
- **DoD:** Hesap silme sonrası Firestore'da artık veri kalmadığı test+manuel ile teyit
- **Efor:** M

### ▸ FAZ 4 QUALITY GATE
`npm run preflight` exit 0 · onboarding (yaş+KVKK+consent) cihazda smoke · veri export çalışır · hesap silme cascade doğrulandı

---

## FAZ 5 — P1 SAĞLAMLAŞTIRMA (en iyi 2g / en kötü 4g)

> P1 bulguları. Native rebuild gerektirenler (WP-5.1, 5.2, 5.12) Faz 1 prebuild'ine de alınabilir — G1.

| WP | Konu | Kaynak | Dosya | Efor |
|---|---|---|---|---|
| WP-5.1 | ProGuard keep rules (WebRTC + BLE + Firebase) | Android P1-4 | `proguard-rules.pro` | S |
| WP-5.2 | `USE_FULL_SCREEN_INTENT` + notification channel (`bypassDnd`, lockscreen PUBLIC) | Android P1-6, P2-9 | Manifest, `MultiChannelAlertService.ts` | S |
| WP-5.3 | BLE replay (timestamp eşiği 5dk) + scan duty cycle (battery) | Security P1-5, Perf P0-2 | `MeshNetworkService.ts:2357`, `HighPerformanceBle.ts:709` | M |
| WP-5.4 | Firestore listener cleanup pattern (81 onSnapshot) | Perf P1-2 | SOS/Voice/Family listener servisleri | M |
| WP-5.5 | Türkçe karakter düzeltmeleri (UTF-8) | UX P1-1, P3-2 | `EditMemberModal.tsx`, `SOSHelpScreen.tsx` | S |
| WP-5.6 | Asset sıkıştırma (premium görsel → WebP, ~128MB→~15MB) | Perf P1-1 | `assets/images/premium/` | S |
| WP-5.7 | Background konum minimization (paylaşım/SOS dışında foreground-only) | Privacy P1-2 | `useLiveLocation.ts`, `FamilyTrackingService.ts` | M |
| WP-5.8 | SOS broadcast fan-out pagination | Backend P2-4 | `sos.ts:506` | M |
| WP-5.9 | EEW AI-tahmin vs resmi-uyarı UI ayrımı (kodda zorunlu badge) | Safety P1-A, UX P2-2 | `WaveVisualizationScreen.tsx` | S |
| WP-5.10 | ConversationScreen slice selector (jank fix) + onboarding izin priming | Perf P0-1, UX P1-4 | `ConversationScreen.tsx:256`, `OnboardingScreen.tsx` | M |
| WP-5.11 | AI streaming feature flag | Release P1-2 | `app.config.ts` | M |
| WP-5.12 | Cert pinning (Firebase + AFAD + Kandilli) | Security P1-11 | `Info.plist`, network katmanı | L |
| WP-5.13 | Composite index'ler + SMTP Secret Manager | Backend P1-3/4, DB P3-1/2 | `firestore.indexes.json`, `admin.ts:35` | M |
| WP-5.14 | iOS `buildNumber` monoton artır (App Store Connect ile senkron) | iOS P1-4 | `app.config.ts:179` | S |
| WP-5.15 | BLE replay'i kapsayan `seenIds` MMKV persist | Security P1-5 | `MeshNetworkService.ts` | S |
| WP-5.16 | Firestore family-link tek-yönlü→mutual düzeltme | DB P1-2 | `firestore.rules:67` | M |

Her WP — DoD: ilgili test + lint + (native ise) cihaz doğrulaması.

### ▸ FAZ 5 QUALITY GATE
`npm run preflight` exit 0 · battery profili (BLE duty cycle) ölçüldü · ConversationScreen 500+ mesajda jank yok · tüm P1 testleri yeşil

---

## FAZ 6 — REGRESYON, CİHAZ DOĞRULAMA, YAYIN (en iyi 1g / en kötü 2g)

#### WP-6.1 — Konsolidasyon & CI
- 40+ staged + faz değişikliklerini mantıksal commit'lerle topla → `main` PR → CI yeşil
- `npm run preflight` + `npm run validate:production` exit 0
- CI Node sürümünü `20.19.4`'e hizala (Release P3-2)

#### WP-6.2 — Cihaz smoke test matrisi
`RELEASE_CHECKLIST.md` (v1.6.3 güncel) tüm senaryolar — **gerçek cihazlarda**:
- iOS: iPhone SE (küçük) + iPhone 15+ ; iOS 16/17/18
- Android: low-end 2GB + Samsung A14 ; Android 13/14/15
- Senaryolar: onboarding (yaş+KVKK+izin), SOS (online/offline/no-peer/iptal), EEW (alert + AI advisory ayrımı), mesaj (online/offline tick), health sharing gate, hesap silme, **v1.6.2→v1.6.3 upgrade (MMKV migration)**

#### WP-6.3 — Staged rollout
- iOS App Store: Phased Release açık (%1→%100, 7 gün)
- Android Play: %10 → izle (Crashlytics) → %25 → %50 → %100
- Her aşamada crash-free rate > %99.5 olmadan sonraki aşamaya geçme
- Kötüleşme → Play "halt rollout" / App Store phased durdur

### ▸ FAZ 6 QUALITY GATE (YAYIN GO/NO-GO)
12-uzman DoD'lerinin tümü kapalı · crash-free > %99.5 (Internal/TestFlight) · `RELEASE_CHECKLIST` tüm kutular işaretli · master audit'teki P0 sıfırlandı

---

## FAZ 7 — v1.7'ye ERTELENEN (P2/P3 + Ürün)

Bu sürümün **blocker'ı değil** — ayrı sürüm planı:
- **Native temizlik:** Android legacy BLE permission guard, `WRITE_SETTINGS`/`SYSTEM_ALERT_WINDOW` release'ten çıkar, deprecated storage izinleri; iOS deprecated key'ler.
- **Database:** Storage `maps/` public-read kapat, hot-document (`conversations` rate-limit) CF'ye taşı.
- **Performance:** `init.ts` faz ayrıştırma, çift GPS watcher, web+native Firebase SDK çift bundle.
- **UX:** offline harita, harita clustering, NotificationSettings basitleştirme, dark mode, a11y label tamamlama, empty state'ler.
- **Safety/Ürün:** çok dilli destek (Arapça — mülteci nüfus), sahte SOS bildirme, BLE device-ID rotation (stalkerware), aile-takip domestic-abuse disclaimer, Volunteer modülü (gerçek veri ya da kaldır), kayıp/bulunan kişi bildirimi, crowdsourced sismik ağ (opt-in), iOS Widget/Watch.
- **BLE broadcast tam ECDH çözümü** (WP-2.6'nın kalıcı hali).

---

## RİSK MATRİSİ (en yüksek dikkat)

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| MMKV migration yanlış → kitlesel logout | Orta | Çok yüksek | WP-2.5 zorunlu upgrade testi (v1.6.2→1.6.3 fiziksel cihaz) |
| Firestore rules sıkılaşması meşru akışı kırar | Orta | Yüksek | Emulator + rules unit test + client write pattern taraması |
| Native rebuild ile başka native modül kırılır | Orta | Yüksek | Tek prebuild, sonra tam smoke matrisi (WP-6.2) |
| Apple Critical Alerts onayı gecikir | Yüksek | Orta | Faz 0'da başlat; onaysız da yayınlanır (EEW kritik-alert vadedilmez) |
| Backend deploy server-mobile drift | Düşük | Yüksek | Backend değişiklikleri geriye uyumlu; breaking olan mobil ile senkron |
| 40+ değişiklik regresyon | Yüksek | Orta | Faz faz commit + faz quality gate + Faz 6 tam smoke |

---

## TOPLAM EFOR & TAKVİM

| Faz | İçerik | En iyi | En kötü |
|---|---|---|---|
| Faz 0 | Lead-time (paralel) | — | (1-4 hafta Apple) |
| Faz 1 | Crash & store blocker | 1g | 2g |
| Faz 2 | Exploit & sızıntı | 2g | 3g |
| Faz 3 | SOS & test | 1.5g | 3g |
| Faz 4 | Compliance | 2g | 4g |
| Faz 5 | P1 sağlamlaştırma | 2g | 4g |
| Faz 6 | Regresyon & yayın | 1g | 2g |
| **TOPLAM** | **P0+P1 tam kapsam** | **~9.5 iş günü** | **~20 iş günü** |

> Sadece P0 (Faz 1-4 + Faz 6) ile dar yayın: **~7.5–14 iş günü**.
> Faz 5 (P1) bu sürüme alınırsa dünya-standardı hedefine ulaşılır — önerilen.
> Apple Critical Alerts onayı takvime paralel; gelmezse EEW kritik-alert
> özelliği v1.6.4'e bırakılır, yayın bloke olmaz.

---

*Ultra Plan · AfetNet v1.6.3 · 2026-05-20 · Kaynak: reports/AUDIT-v1.6.3.md*
