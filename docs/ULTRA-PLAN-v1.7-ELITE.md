# AfetNet ULTRA PLAN — v1.7 ELITE
## Bütün 150 bulgu için tek mimari yol haritası

> **Yazım amacı:** Geride 5 farklı agent + manuel review'dan ~150 bulgu kaldı. Bu döküman onları **rastgele bug listesi** olarak değil, **12 mimari tema** olarak gruplar; her tema için (a) neden bu pattern bizde var, (b) elite mühendislik nasıl yapar, (c) bu uygulama için somut adım. Sonunda 5 fazlık execution planı + her bulgunun faz eşlemesi var.
>
> **Hedef okuyucu:** Gökhan + bir sonraki Claude oturumu + ekibe gelirse yeni mühendis. Her cümle aksiyon-üretici.
>
> **Versiyon mantığı:** v1.6.3 = ŞU AN, dondurulmuş, sadece TestFlight internal. v1.6.4 = ship-blocker fix sprint'i (2 hafta). v1.7 = mimari refactor sprint'i (4-6 hafta). v2.0 = elite-grade yeniden inşa noktası (sonraki çeyrek değerlendirilir).

---

## 1. YÖNETİCİ ÖZETİ

5 elite agent + 1 manuel review = **~150 bulgu** (30 CRITICAL, 50 HIGH, 40 MEDIUM, 30 LOW).
Bu bulgular **rastgele değil**: **12 tekrar eden mimari pattern**'a sığıyor. Yani 150 ayrı düzeltme yapmak yerine, **12 mimari prensipi doğru kurarsan** çoğu birden çözülür.

**Şu anki gerçek**:
- `v1.6.1` App Store'da canlı, stabil ama eksik özellikli.
- `v1.6.3` working tree'de, 10 commit ile çok fix var **ama 2 yeni regression + ~28 önceden var olan critical bug** ortaya çıkardı.
- "E2EE" iddiası ile **cloud'da plaintext storage** yapılması KVKK/GDPR yasal risk.
- **Cross-account state leak** + **pending invite PII disclosure** = KVKK Madde 7 ihlal potansiyeli.

**Tavsiye edilen ship sırası**:
1. **v1.6.3 → DONDUR** (TestFlight internal only, App Store submit ETME).
2. **v1.6.4 sprint** (2 hafta) → 8-10 ship-blocker düzeltir, App Store'a o gider.
3. **v1.7 sprint** (4-6 hafta) → mimari temelleri sertleştirir.
4. **v2.0 değerlendirme** → bazı pattern'ler (E2EE, on-device EEW) ground-up rewrite gerektirebilir.

---

## 2. DURUM TESPİTİ — Neden bu kadar bulgu var?

App'in geçmişi: **3 yılda 1.6 sürüm**, çok iterasyon, çok ad-hoc fix. Sonuç:
- **God-class servisler** (UnifiedSOSController ~1200 satır, MeshNetworkService ~3300 satır, NotificationCenter ~2200 satır).
- **Singleton coupling** — her servis diğerini `require()` ile dinamik import ediyor, dependency graph görünmez.
- **Çok sayıda paralel "fix" pattern'i** — `_v2`, `_v3`, `legacy`, `görev #X`, sprint-audit-fix etiketleri kod tabanına yapıştırılmış katmanlar.
- **Test coverage düşük gerçek path'lerde** — 356 jest test var ama coalesceSosBeacons (benim yeni yazdığım), Swift native code, multi-source EEW consensus, E2EE round-trip için **sıfır**.
- **No observability** — Sentry/Crashlytics yarım kurulu, structured logging yok, production'da sessiz fail'ler.
- **No CI gates** — tsc/eslint/jest yerel; PR'da rule emulator test'i yok.

Bu pattern'ler **insan suçu değil — solo developer realitesi**. Bir kişi 1.6 sürüm boyunca life-critical app yazdıysa, bu sonuç **normal** ve **düzeltilebilir**.

---

## 3. 12 MİMARİ TEMA — Pattern analizi + elite çözüm

### TEMA 1 — Veri tutarlılığı, idempotency, dedup

**Bu app'te tezahürü:**
- EEW C4: `EEWService.seenEvents` + `MultiSourceEEWService.seenEventIds` AYRI Map'ler → aynı deprem 2x notification.
- EEW M3: `eewWebhook` id default `Date.now()` → her retry yeni id → idempotency bypass (düzelttim).
- SOS-receive H3: signalId 4 farklı path'ten gelir (Firestore listener, mesh, push, foreground) → farklı casing → dedup miss.
- Messaging C2: offline mesaj 5dk sonra `isRecentClientTimestamp` rule ile **kalıcı silinir**.
- Messaging H4: `HybridMessageService` + `MeshMessageBridge` her ikisi de `meshNetworkService.onMessage` dinler → her DM 2x process.
- Cancel outbox vs broadcast outbox race (C2 staff).
- AccountDeletion `secureId` collision senaryoları.

**Neden bu pattern var:**
Her özellik kendi dedup state'ini kuruyor; "tek doğruluk kaynağı" yok. Her servis kendi `seenIds: Set<string>` tutuyor.

**Elite engineering nasıl yapar:**
- **Tek bir EventBus** (RxJS/EventEmitter wrapper) tüm cross-cutting eventler için.
- **Idempotency key contract**: her event'in `key: source:logicalId:timeBucket` formatında DETERMINISTIC key'i olur, EventBus level'de dedup yapılır.
- **Transactional outbox pattern** (Microservices Patterns kitabı): outbox-relayer ayrı; client write + outbox sync atomic.
- **Event sourcing** lifesafety eventler için: event log = single source of truth; state = derived projection.
- **idempotency-key HTTP header convention** (Stripe/AWS pattern) backend için.

**Bu uygulama için somut adım:**
- `src/core/services/EventBus.ts` kurulur. Her notification path (EEW + SOS + mesh + push + Firestore listener) bu bus üzerinden geçer. Bus'ta `dedup({ key, ttlMs })` API'si.
- Tüm dedup key'leri **standartlaştır**: `${domain}:${logicalId}:${timeBucket}` (örn. `eew:afad-12345:202605221130`).
- Mesh ve Cloud listener'ları bus'a feed eder; UI bus'tan dinler.
- Cancel/broadcast outbox'ı **birleştir**: tek `cloudOutbox` (operation type ile ayır), serial processing.
- Messaging timestamp: client write için `clientCreatedAt` UI'da, `timestamp: serverTimestamp()` Firestore'da → 5dk rule asla expire etmez.

---

### TEMA 2 — Cross-account / multi-tenancy / state hijiyen

**Bu app'te tezahürü:**
- Auth C2: User A çıkıyor, B giriyor → A'nın in-memory state'i B'ye sızıyor (health profile, presence).
- Auth M2: `IdentityService.getCachedAppleName('_latest')` global key → User B Apple display name'i User A'nın oluyor.
- Auth H2/M4: FCM token signout'ta cleanup yok → multi-device hayalet token.
- Family C2 (recent): Apple cached name account-switch'te overwrite olmuyor.
- SessionSecurityService `getStorageKeys()` init'te `anonymous` scope'a yazar, signin sonrası re-init yok.

**Neden bu pattern var:**
Singleton servisler module-load'da instantiate edildi; "user-scoped" lifecycle yok. State, auth değişiminde manuel `cleanup()` çağrılarına dayanıyor; eksik kalanlar leak ediyor.

**Elite engineering nasıl yapar:**
- **Request-scoped DI container** (web backend pattern): her request/user için yeni service instance.
- Mobil'de eşdeğeri: **AuthGate component**, auth değiştiğinde tüm `useEffect` cleanup'lar TAMAMEN tetiklenir, store'lar resetlenir.
- **Per-uid state container** (Redux/Zustand'da `useUserStore({ uid })` pattern).
- **Global key'ler YASAK** — her storage key UID-scoped: `afetnet:${uid}:apple_name`.
- **Logout = orchestrator** — bir liste; her servisin `onLogout()` hook'u, sıra ile çağrılır, biri fail ederse fail-loud.

**Bu uygulama için somut adım:**
- `src/core/auth/AuthLifecycle.ts` ekle. Servislerin kayıt olduğu `register(onLogin, onLogout)` API'si.
- `IdentityService.getCachedAppleName()` UID-scoped key olur; `_latest` global key SİLİNİR.
- `EmergencyHealthSharingService.initialize()` her signin'de zorunlu çağrılır (auth gate).
- FCM token: `AuthService.signOut` içine `await fcmTokenService.cleanup(uid)` eklenir.
- SessionSecurityService init'i `whenAuthReady()` ile gate'lenir.

---

### TEMA 3 — E2EE ve gerçek veri güvenliği

**Bu app'te tezahürü:**
- Messaging C3: Cloud'da PLAINTEXT mesaj. Sadece BLE mesh için `meshCryptoService.encryptMessage`. UI "E2EE" diyor → **YALAN**.
- `xorEncrypt`/`xorDecrypt` deprecated ama kod tabanında.
- CryptoService keypair lifecycle: önceki post-mortem'de regression vardı (persist'ten önce atama).
- Security C1: `isSecureStoreAvailable` false dönüyorsa E2EE sessizce devre dışı, kullanıcıya bildirim yok.
- Messaging L1: HEALTH_SOS packet'inde imza yok → spoofable.

**Neden bu pattern var:**
Signal Protocol'a yatırım yapılmamış. BLE mesh için ad-hoc curve25519+nacl yapıldı; cloud için "Firebase zaten güvenli" varsayımı.

**Elite engineering nasıl yapar:**
- **Signal Protocol** (Open Whisper Systems) — endüstri standardı, multi-device + forward-secret + post-compromise security. `@signalapp/libsignal-client` (Apache 2.0) veya `react-native-libsignal` (community).
- **Olm/Megolm** (Matrix) alternatif — açık spec, daha küçük.
- **Per-recipient ECDH** Firestore yazma öncesi client-side şifreleme; sunucu sadece blob görür.
- **Honest disclosure**: E2EE yoksa "Server-readable" diye dürüst etiketle (WhatsApp vs SMS ayrımı gibi).
- **Key transparency** (CONIKS/Keybase) — public key directory'nin denetlenebilir log'u.

**Bu uygulama için somut adım:**
**Karar yolu (v1.6.4'te SEÇ):**
- **Option A — E2EE iddiasını düşür**: UI'dan "E2EE" yazısını "Sunucu Üzerinden" diye değiştir. KVKK Aydınlatma Metni'ne "sunucuda saklanır" ekle. 1 günlük iş. Yasal güvenlik tam.
- **Option B — Signal Protocol entegre et**: `@signalapp/libsignal-client` deploy, `MessageEncryptionService` katmanı, Firestore'a `ciphertext` + `senderKeyId` yaz. 2-3 haftalık iş. Türkiye için ciddi güvenlik avantajı.
- **Option C — Olm/Megolm**: daha küçük integration, 1-2 hafta. Matrix.org'a benzer model.

Tavsiyem **B** (Signal). Türkiye'de afet senaryosunda mesajların hükümet talebi ile açılabilirliği gerçek tehdit; E2EE pazarlama değil teknik gereklilik.

---

### TEMA 4 — Firestore rules / KVKK / privacy by design

**Bu app'te tezahürü:**
- SOS-receive C2: `firestore.rules:1386-1389` `sos_broadcasts` read'i sadece sender → NearbySOSListener (492 satır) **DEAD CODE**.
- Messaging C6: 700ms rate-limit rule DEAD (yanlış key type — `lastMessage` map değil string).
- Auth H8/H9: Pending family invite, recipient onaylamadan **UID/displayName/email'i yazıyor** → KVKK Madde 4 (asgari veri).
- Auth M2: Apple name `_latest` global → cross-account PII leak.
- Crowdsourced #15 (defer): seismicDetections read açık → konum verisi exposure.
- Devices/messages #16: relationship check yok → spam.

**Neden bu pattern var:**
Rules iteratively yazıldı, "çalışsın" odaklı. KVKK by design baştan dahil edilmedi. Rules için test yok → karmaşık helper fonksiyonların doğruluğu kanıtlanmamış.

**Elite engineering nasıl yapar:**
- **Privacy by Design** (Cavoukian 7 prensip): KVKK Madde 4'ün teknik karşılığı. **Asgari veri** + **amaç sınırlaması** + **şeffaflık** + **kullanıcı kontrolü**.
- **Defense in depth**: client validation + Firestore rules + Cloud Function validation + monitoring (4 katman).
- **Rules-as-code testing**: Firebase Emulator + `@firebase/rules-unit-testing`. Her rule için pozitif + negatif test.
- **Consent-first messaging**: Yeni biriyle ilk mesaj = **request**, alıcı kabul edene kadar **PII paylaşılmaz** (Snapchat/Instagram pattern).
- **Audit trail**: her PII erişimi loglanır, kullanıcı kendi audit log'unu görebilir.

**Bu uygulama için somut adım:**
- **`firestore-rules-test/` dizini** kur: `pnpm add -D @firebase/rules-unit-testing firebase-tools`. Her kural için suit.
- **Pending invite UX**: AddFamilyMemberScreen → `contact_requests/{recipientUid}/incoming/{senderUid}` yazar (sender'ın UID'i + opaque inviteCode). Recipient kabul edince `family_members/...` yazılır. **PII transfer alıcı onay sonrası.**
- **NearbySOSListener** ya sil ya da CF-managed `recipientUids` array'i ile rule'u genişlet (rule + CF + client triple change).
- **Crowdsourced #15**: CF aggregate endpoint (`getNearbyDetectionsAggregate(lat, lon)` returns count+avg only, no doc list). Client direct-read yerine bunu çağırır. Rule daraltılır.
- **Messages create rule**: `passesConversationMessageRateLimit` helper'ı düzelt (lastMessageAt + request.time karşılaştırması).

---

### TEMA 5 — Native iOS BLE state management

**Bu app'te tezahürü:**
- SOS-receive CRITICAL-1: Swift `handleStateUpdate` BT toggle resume KIRIK (benim regression).
- SOS-receive CRITICAL-6: Killed app'te BLE state restoration YOK → mesh SOS sessizce kaybolur.
- post-mortem #2: BT power cycle sonrası pendingNotifications stale char ref (önceki regression, kısmen düzelttim).
- subscribedCentrals lifecycle race (subscriber clear ama notification fire ediyor).
- Background scan iOS API limitleri (3 servis UUID limit, 10sn cap).

**Neden bu pattern var:**
iOS BLE arcane bir API; Apple HIG + CoreBluetooth contract baştan referans alınmadan, deneme yanılma ile yazıldı. Kullanım pattern'i React Native bridge'in soyutlamasının üzerine yapıldı, native restoration özelliği eksik.

**Elite engineering nasıl yapar:**
- **State machine formal**: `BLEPeripheralState = { Off, Authorizing, Idle, Advertising, Restoring }`. Her geçiş açık handler.
- **State Restoration**: `CBCentralManager(delegate:, queue:, options: [CBCentralManagerOptionRestoreIdentifierKey: "AfetNetCentral"])` + `application:willFinishLaunchingWithOptions:` bridge → killed app'te iOS yeniden başlatır.
- **Background mode declaration** doğru — `UIBackgroundModes: ["bluetooth-central", "bluetooth-peripheral"]` (var ✓).
- **Apple WWDC 2013 "Core Bluetooth State Preservation"** session referans.
- **Karma Mobile** / **Bridgefy** / **Briar** açık-kaynak mesh BLE projeleri pattern referansı.
- **Unit test for Swift module**: XCTest + CBPeripheralManager mock.

**Bu uygulama için somut adım:**
- `handleStateUpdate` STATE MACHINE'e refactor — explicit `previousState`, `targetState`, transition matrix.
- `wasRunning` lokal değil instance variable `shouldAutoResumeOnPowerOn: Bool`; off → set true, on → branch on it.
- Background restoration: `AppDelegate.application(_:willFinishLaunchingWithOptions:)` ile CBPeripheralManager restoration setup.
- Restoration identifier ile relaunch alındığında JS bridge'e event emit → JS karşı tarafta init bekler.
- `pendingNotifications` after-resume remap (zaten kısmen yapıldı, ama BT-resume path düzeltilince doğrulanmalı).
- XCTest suite ekle: `modules/afetnet-ble-peripheral/ios/Tests/`.

---

### TEMA 6 — AppState lifecycle ortak handling

**Bu app'te tezahürü:**
- SOS-receive CRITICAL-3: mesh-SOS `!== 'background'` (benim regression) — iOS 'inactive' state'te React render suspend, modal paint etmez.
- SOSAlertListener `=== 'active'` (consistent ama benim mesh fix'i ayrıştı).
- Notif C6: cold-start tap timeout 10s; auth yetişmezse tap kaybolur.
- Init race: services init'i auth'tan önce başlayabilir (SessionSecurityService anonymous scope).

**Neden bu pattern var:**
AppState her servis kendi handler'ını yazıyor, ortak doğruluk kontratı yok. RN AppState'in 'inactive' semantiği iOS'a özgü incelik (incoming call banner, app switcher, control center) — bilinmeden farklı yorumlandı.

**Elite engineering nasıl yapar:**
- **Tek `AppLifecycleService`** — AppState + auth + bootstorage'ın birleşik state machine'i.
- States: `Booting`, `Authenticating`, `Active`, `Inactive`, `Background`, `Suspended`, `Resuming`.
- Servisler `lifecycleService.onState((state) => ...)` ile dinler.
- iOS 'inactive' = "kısa kesinti, JS canlı ama UI render guarantee yok"; mesh emit YAPABILIR ama OS notification de FALLBACK olarak ATILIR — belt-and-suspenders.
- React Native: `useFocusEffect` (navigation) + `AppState.addEventListener` (lifecycle) ayrı.
- Cold-start tap: **persistent queue** (MMKV) → init/auth tamamlandıktan sonra çağrılır, asla timeout'la kaybolmaz.

**Bu uygulama için somut adım:**
- `src/core/AppLifecycleService.ts` kur. Tüm AppState dinleyicileri buradan çatallanır.
- SOS notification gate: hem emit hem OS notif paralel ATIL — UI tarafında dedup (zaten 30s window var).
- Cold-start notification queue MMKV'ye persist; init.ts auth + navigation hazır olunca drain et.
- AuthGate component: tüm route'lar bunun altında, lifecycleService.state'e abone.

---

### TEMA 7 — Notification mimarisi (push + local + critical)

**Bu app'te tezahürü:**
- Notif C1: `@react-native-firebase/messaging` yüklü değil, background FCM data-only push **sessizce düşer**.
- Notif C3: iOS Critical Alerts entitlement DOSYADA YOK → EEW/SOS DND bypass çalışmaz.
- Notif C7: Backend `interruption-level: critical` hiç göndermiyor (sadece `time-sensitive`).
- Notification 4 farklı path'ten gelir (Firestore listener, mesh, push, foreground), dedup parçalı.
- Android channel ID consolidation devam ediyor (görev #27 partial).

**Neden bu pattern var:**
Expo-only setup ile başlandı, sonra critical alerts gibi advanced özelliklere ihtiyaç çıkınca eklendi ama tamamlanmadı. Apple'ın Critical Alerts başvuru süreci (1-4 hafta) henüz başlatılmamış.

**Elite engineering nasıl yapar:**
- **Push delivery contract**: `{ alert, sound, badge, category, interruption-level, thread-id, target-content-id }` — Apple HIG'in tam karşılığı.
- **APNS interruption-level matrisi**:
  - `critical` → DND bypass (EEW + SOS only, entitlement gerek)
  - `time-sensitive` → Focus mode bypass (family alert)
  - `active` → normal
  - `passive` → silent
- **FCM data-only + notification dual payload**: backend her zaman BOTH gönderir; foreground handler data'yı işler, background OS notification'ı gösterir.
- **Notification Service Extension** (iOS): payload modify (e.g., decrypt encrypted notification) before display.
- **`@react-native-firebase/messaging`** YERİNE `expo-notifications` data-only kaldıramaz — gerek varsa Firebase native modülü eklenir.

**Bu uygulama için somut adım:**
- **Hemen (v1.6.4)**: `pnpm add @react-native-firebase/messaging` (zaten `@react-native-firebase/app` var). `index.ts`'e `setBackgroundMessageHandler` ekle.
- **iOS entitlement**: Apple Developer'da Critical Alerts başvurusu BAŞLAT (önceden yapılmadıysa) — 1-4 hafta paralel. Entitlement geldiğinde `AfetNetAcilletiim.entitlements`'a `com.apple.developer.usernotifications.critical-alerts = true`.
- **Backend payload**: `functions/src/utils.ts:385-387` `iosInterruptionLevel` union'ına `'critical'` ekle; EEW + SOS path'leri kullansın.
- **Notification Triage Service**: tek bir router, kategoriye göre channel + dedup key + interruption level.
- **Test**: Firebase Admin SDK ile programatic push gönderim test'i (E2E).

---

### TEMA 8 — On-device EEW: gerçek bilim vs sahte fizik

**Bu app'te tezahürü:**
- EEW C6: `OnDeviceEEWService.estimateWarningTime` FREKANSA dayalı, fiziksel olarak ANLAMSIZ. Fake countdown ETA gösterir.
- EEW C10: `parseAFADDate` `Date.now()` fallback bozuk veride fake-fresh event.
- EEW H1: consensus map 0.01° rounding → multi-source dedup miss.
- EEW C5: Kandilli 3rd-party proxy auth yok → spoof vektörü.
- BackgroundSeismicMonitor yalancı "7/24 koruma" iOS'ta gerçekçi değil.

**Neden bu pattern var:**
P-wave detection MEMS sensor + STA/LTA ad-hoc yazıldı, peer-reviewed algoritma referansı yok. USGS/ShakeAlert paper'ları kaynaklarda yok.

**Elite engineering nasıl yapar:**
- **USGS ShakeAlert** referans algoritma: `ElarmS-3` / `FinDer` / `EPIC` — 3 farklı detector, consensus ile alarm. Açık kaynak: https://github.com/UrbanResearchInst/CISN-EEW
- **Wadati S-P picker** P-wave onset için gold standard (1933).
- **MyShake** (UC Berkeley) — smartphone-based EEW pioneer, peer-reviewed papers. Açık-kaynak değil ama paper'ları referans.
- **Earthworm / SeisComP** professional seismology stack — entegrasyon overkill ama paper'lar değerli.
- **Honest UX**: tahmin imkansızsa "ŞİDDETLİ SARSINTI ALGILANDI — HEMEN ÖRT VE KORUN" göster, ETA verme.

**Bu uygulama için somut adım:**
**v1.6.4**:
- Frekansa dayalı countdown KALDIR. Sadece "shake detected" + intensity bucket ("orta / şiddetli / çok şiddetli") göster.
- "X saniye" yazısını sil → "HEMEN ÖRT, KORUN, TUTUN" göster.
- Marketing material'lerden "ETA" iddiasını çıkar.

**v1.7**:
- ShakeAlert ElarmS-3 paper okunur, basitleştirilmiş Wadati picker implement edilir.
- Composite key fallback (parseAFADDate fix) ile fake-fresh event riski elimine.
- Kandilli proxy yerine HMAC-signed proxy yaz veya AFAD+USGS+EMSC redundancy ile Kandilli'yi kaldır.

**v2.0** (değerlendir):
- Crowdsourced consensus için Bayesian aggregator (Stanford/Caltech literature).
- Background ML model (CoreML) — MyShake yaklaşımı.

---

### TEMA 9 — Background services iOS limit gerçeği

**Bu app'te tezahürü:**
- BackgroundSeismicMonitor ≥15dk fetch interval (iOS Background Fetch limit).
- "7/24 koruma" pazarlama claim'i teknik olarak yalan.
- Background BLE scan iOS'ta limited (3 service UUID, sleep mode'da inactive).
- Killed app SOS reception arch limit (Tema 5 ile bağlantılı).

**Neden bu pattern var:**
iOS'un katı background execution policy'si (battery koruma için) anlaşılmadan, Android-style "her zaman çalışır servis" varsayımı.

**Elite engineering nasıl yapar:**
- **iOS Background Modes** doğru kullanım: `bluetooth-central` + `bluetooth-peripheral` (BLE arka plan) + `location` (sürekli GPS).
- **BGTaskScheduler** (iOS 13+) — sistem app'i uygun zamanda uyandırır (battery + thermal + network).
- **Significant Location Change** (sadece konum değiştiğinde, battery dostu).
- **Voice Over IP background mode** SUI değil — gerçek VoIP yoksa Apple reject eder.
- **Honest documentation**: "iPhone'da arka plan 15 dk fetch + BLE wake-up + significant location" — onboarding'de söylenir.
- **Apple Watch Workout-style continuous monitoring** — extended runtime için Apple Watch Companion uygulaması seçenek.

**Bu uygulama için somut adım:**
**v1.6.4**:
- Onboarding ve Settings'te **dürüst açıklama**: "iPhone'da arka planda her 15 dk kontrol; öncesinde uyanmak için bildirim açık olmalı."
- "7/24 koruma" yazılı tüm yerleri "Mümkün olduğunda arka planda izleme" diye değiştir.

**v1.7**:
- `BGTaskScheduler` doğru implementasyon (mevcut `expo-background-fetch` üstüne).
- Significant Location Change opt-in.
- Apple Watch Companion app değerlendir (v2.0).

---

### TEMA 10 — Error handling, observability, "sessiz fail"

**Bu app'te tezahürü:**
- Notif/SOS listener'lardaki `permission-denied` DEV-only log.
- `catch { /* */ }` boş yutma yer yer.
- Sentry/Crashlytics yarım kurulu (önceki audit'te `firebase.json` analytics kapatma görevi var).
- Structured logging yok — `logger.warn(...)` ama searchable field yok.
- SLO/metric yok.

**Neden bu pattern var:**
Solo dev için "loglara bakacak vakti yok" psikolojisi; production gözlemleyicilik kültürü kurulmadı.

**Elite engineering nasıl yapar:**
- **Three pillars of observability** (Google SRE):
  - **Logs**: structured (JSON), correlation ID, level, redacted PII.
  - **Metrics**: counters + gauges + histograms; Prometheus/Grafana.
  - **Traces**: distributed (OpenTelemetry), her request bir trace ID.
- **SLO** (Service Level Objective) her kritik özellik için: "SOS broadcast success rate ≥99.5% rolling 30 günde".
- **Error budget**: SLO altında değilse yeni feature freeze.
- **Postmortem culture**: her incident yazılır, blameless, action items.
- **Sentry/Crashlytics** dolu setup: source map upload, release tracking, alert routing.

**Bu uygulama için somut adım:**
**v1.6.4**:
- Sentry tam setup — DSN env, source map upload EAS post-build hook, release version tagging.
- Pino-style structured logger (`logger.info({ event: 'sos_broadcast_complete', signalId, channels })` — searchable).
- Her catch block YA error fırlatır YA Sentry'ye breadcrumb düşer; boş catch YASAK.
- ESLint custom rule: `no-empty-catch` enforce.

**v1.7**:
- OpenTelemetry RN entegrasyonu (mobile traces → Honeycomb/Datadog).
- SLO panosu (Grafana): SOS delivery, EEW latency, app crash-free rate.
- PagerDuty alert: SOS delivery rate düşerse on-call dev'e ping.

---

### TEMA 11 — Test coverage gerçek path'lerde

**Bu app'te tezahürü:**
- 356 jest test ama:
  - `coalesceSosBeacons` (benim yeni kodum): 0 test.
  - Swift native: 0 test.
  - Multi-source EEW consensus: 0 test.
  - E2EE round-trip: 0 test.
  - Firestore rules: 0 test.
  - Cold-start notification routing: 0 test.

**Neden bu pattern var:**
Test pyramid'in alt katmanı (unit) doluyken üst katmanlar (integration, E2E) eksik. "Hızlı ship" baskısı.

**Elite engineering nasıl yapar:**
- **Test pyramid** (Mike Cohn): unit (70%) > integration (20%) > E2E (10%).
- **Contract tests** (Pact) — servisler arası kontrat doğrulama.
- **Snapshot tests** (Jest) — UI regression için (önemli component'ler).
- **Mutation testing** (Stryker) — test'lerin GERÇEKTEN bug yakalayıp yakalamadığını ölçer.
- **Property-based testing** (fast-check) — input space exploration.
- **Firestore Rules Emulator** — her rule için pozitif + negatif test.
- **Detox** veya **Maestro** mobile E2E — gerçek senaryolar.
- **TestFlight beta cohort** — her release önce 100 kullanıcıya yayılır.

**Bu uygulama için somut adım:**
**v1.6.4**:
- `coalesceSosBeacons` için unit test (mock queue + dedup behavior).
- AFAD UTC parse için regression test (zaten yazdım, devam).
- Firestore rules emulator setup + 10 kritik rule için test.

**v1.7**:
- Maestro E2E suite: SOS flow (countdown → broadcast → cancel → retrigger), EEW notification → countdown → impact, family add/remove.
- Swift native test (XCTest).
- Coverage gate CI'da: 80% line, %95 critical path.

---

### TEMA 12 — Architectural drift: DDD ve clean architecture

**Bu app'te tezahürü:**
- God-class servisler (UnifiedSOSController 1200+, MeshNetworkService 3300+, NotificationCenter 2200+).
- `require('./Service')` dinamik import — dependency graph görünmez, circular dep riskli.
- Domain logic + I/O + UI orchestration aynı dosyada.
- No bounded contexts — "SOS" + "Family" + "Mesh" iç içe.
- Hooks/components arası business logic dağılmış.

**Neden bu pattern var:**
"İlk önce çalışsın, sonra düzeltiriz" iterative dev pattern'i. Refactor için sprint ayrılmadı.

**Elite engineering nasıl yapar:**
- **Hexagonal Architecture** (Alistair Cockburn) / **Clean Architecture** (Uncle Bob):
  - **Domain** (entities + use cases) → puro business logic, framework-agnostic.
  - **Application** (use case orchestration) → ports.
  - **Infrastructure** (Firestore, BLE, expo-notifications) → adapter implementations.
  - **Presentation** (React components) → UI sadece.
- **Domain-Driven Design** (Eric Evans): bounded contexts (SOS, EEW, Family, Messaging), aggregate roots.
- **Dependency Injection container** (`tsyringe`, `inversify`).
- **CQRS** (Command Query Responsibility Segregation) — yazma vs okuma path'leri ayrılır.
- **Event-driven architecture** (Tema 1'le sinerji).

**Bu uygulama için somut adım (incremental, big-bang yok):**
**v1.7 sprint 1**: 1 bounded context pilot — SOS.
- `src/sos/domain/` — `SOSSignal` entity, `BroadcastSOS` use case, `CancelSOS` use case.
- `src/sos/application/` — `SOSBroadcastService` (uses domain).
- `src/sos/infrastructure/` — `FirebaseBroadcastAdapter`, `MeshBroadcastAdapter` (port implementations).
- `src/sos/presentation/` — `SOSModal`, `SOSFullScreenAlert`.
- DI container ile bağlanır.

**v1.7 sprint 2-3**: EEW, Family, Messaging benzer pattern'e refactor.

**v2.0**: tam clean architecture.

---

## 4. 5-FAZ EXECUTION PLAN

### FAZ 0 — STOP & STABILIZE (BUGÜN, 1 gün)

**Hedef**: working tree'yi güvenli baseline'a getir, regression'ları geri al, v1.6.3'ü TestFlight internal'da dondur, backlog dokümante et.

| # | Görev | Süre | Acceptance |
|---|---|---|---|
| 0.1 | Bu döküman commit (`docs/ULTRA-PLAN-v1.7-ELITE.md`) | 30dk | Repo'da |
| 0.2 | Post-mortem Swift BT resume regression (CRITICAL-1) revert + doğru fix (shouldAutoResume flag) | 1sa | Build success + manuel review |
| 0.3 | Post-mortem AppState `!== 'background'` regression revert → `=== 'active'` + her zaman OS notification fallback | 30dk | tsc + jest yeşil |
| 0.4 | lastKnown validation fix commit (working tree'de hazır) | 10dk | Commit |
| 0.5 | tsc/eslint/jest yeşil doğrula | 10dk | All green |
| 0.6 | `git push origin main` — 11 commit upstream'e | 5dk | Pushed |
| 0.7 | TestFlight build (devam ediyor, biraz daha) → indir, version doğrula | 15dk | 1.6.3 (XX) on device |
| 0.8 | Cihazda **5 temel akış** smoke test (SOS, EEW, mesh, family, messaging) | 1sa | Notlar |

**ÇIKTI**: v1.6.3 dondurulmuş, TestFlight'ta internal test, **App Store'a SUBMIT YOK**, plan documented.

---

### FAZ 1 — SHIP BLOCKER SPRINT (2 hafta, v1.6.4)

**Hedef**: ~10 ship-blocker düzelt, v1.6.4'ü App Store'a yolla.

#### Hafta 1 — Privacy & Compliance (en yüksek hukuki risk)

| # | Görev | Tema | Süre |
|---|---|---|---|
| 1.1 | "E2EE" iddiası karar: A (label change) ya da B (Signal Protocol entegrasyon). Eğer A → 1 günlük, eğer B → 2 hafta'ya yayılır | T3 | 1gün-2hafta |
| 1.2 | Cross-account state isolation: AuthLifecycle.ts + tüm servislerin onLogin/onLogout hook'ları | T2 | 3gün |
| 1.3 | KVKK PII pending invite disclosure: contact_requests pattern + recipient onay sonrası PII | T4 | 3gün |
| 1.4 | Apple Critical Alerts başvurusu BAŞLAT (paralel, 1-4 hafta beklemeye gir) | T7 | 1sa başvuru, 1-4 hafta bekleme |
| 1.5 | `@react-native-firebase/messaging` install + `setBackgroundMessageHandler` | T7 | 1gün |
| 1.6 | Backend interruption-level: critical (EEW + SOS path) | T7 | 1gün |

#### Hafta 2 — Native + Receive Path

| # | Görev | Tema | Süre |
|---|---|---|---|
| 1.7 | Swift handleStateUpdate STATE MACHINE refactor (formal state, shouldAutoResume) | T5 | 2gün |
| 1.8 | Swift `CBPeripheralManager` state restoration (killed app SOS reception için) | T5 | 2gün |
| 1.9 | `trapped` flag erase fix (saveAlertToStore conditional set) | T1 | 1sa |
| 1.10 | Mesh-SOS notification dual-fire (emit + OS notif paralel, UI dedup) | T6 | 4sa |
| 1.11 | "7/24 koruma" pazarlama düzelt: onboarding'de dürüst dil | T9 | 2sa |
| 1.12 | On-device EEW countdown KALDIR → "shake detected" mesajı | T8 | 1gün |
| 1.13 | Sentry full setup + ESLint no-empty-catch enforce | T10 | 1gün |
| 1.14 | v1.6.4 EAS build + TestFlight + 50-100 beta cohort + 1 hafta gözlem | - | 1hafta |

**ÇIKTI**: v1.6.4 App Store'da, kritik ship-blocker'lar düzeltildi, **legal risk indirildi**.

---

### FAZ 2 — ARCHITECTURAL CORRECTNESS (4-6 hafta, v1.7)

**Hedef**: Mimari temelleri sertleştir, observability kur, dedup pattern'ini ana akıma yerleştir.

#### Sprint 1 (2 hafta) — EventBus + Dedup unification

| # | Görev | Tema |
|---|---|---|
| 2.1 | `EventBus` servisi: dedup contract, key naming standard | T1 |
| 2.2 | EEW dedup unification (EEWService + MultiSource → tek EventBus path) | T1 |
| 2.3 | SOS receive 4 path → tek EventBus | T1 |
| 2.4 | Messaging mesh + cloud bridge → tek path (C1 phantom self-DM fix) | T1 |
| 2.5 | Outbox unification (cancel + broadcast → tek FIFO) | T1 |

#### Sprint 2 (2 hafta) — Rules + observability

| # | Görev | Tema |
|---|---|---|
| 2.6 | Firestore rules emulator + 30 rule test (pozitif + negatif) | T4 |
| 2.7 | Rules tightening: rate-limit fix, crowdsourced aggregate, message size cap | T4 |
| 2.8 | NearbySOSListener karar: sil ya da rule+CF refactor | T4 |
| 2.9 | OpenTelemetry tracing setup (mobile traces) | T10 |
| 2.10 | SLO panosu (SOS delivery, EEW latency, crash-free rate) | T10 |

#### Sprint 3 (2 hafta) — Test coverage + DDD pilot

| # | Görev | Tema |
|---|---|---|
| 2.11 | Maestro E2E: SOS flow, EEW flow, family flow | T11 |
| 2.12 | Swift XCTest suite | T11 |
| 2.13 | `src/sos/` DDD refactor pilot — domain/application/infrastructure/presentation | T12 |
| 2.14 | DI container (`tsyringe`) setup, SOS context ilk consumer | T12 |
| 2.15 | v1.7 EAS build → TestFlight beta cohort (1 hafta) → App Store | - |

**ÇIKTI**: v1.7 App Store'da, mimari temeller sağlam, observability canlı.

---

### FAZ 3 — ELITE REFACTOR (8-12 hafta, v2.0)

**Hedef**: Diğer bounded context'ler DDD'ye geçer, advanced özellikler (E2EE B, ShakeAlert).

| # | Görev | Tema |
|---|---|---|
| 3.1 | EEW bounded context refactor | T12 |
| 3.2 | Family bounded context refactor | T12 |
| 3.3 | Messaging bounded context refactor | T12 |
| 3.4 | Signal Protocol full integration (eğer FAZ 1'de A seçildiyse) | T3 |
| 3.5 | ShakeAlert basitleştirilmiş algoritma (Wadati picker) | T8 |
| 3.6 | Apple Watch Companion app (continuous monitoring) | T9 |
| 3.7 | Multi-language (TR + EN + AR — mülteci nüfus) | UX |

**ÇIKTI**: v2.0 endüstri-grade mimari, life-safety app standartlarına yakın.

---

### FAZ 4 — SÜREKLI İYİLEŞTİRME (rolling)

**Hedef**: SLO + error budget + postmortem kültürü canlı.

- Her sprint sonu: SLO review, error budget durumu, postmortem (varsa).
- Her ay: dependency update, security audit, performance review.
- Her çeyrek: architecture review, ADR (Architecture Decision Records) güncelleme.

---

## 5. HER BULGUNUN FAZ EŞLEMESİ (master tablo)

> ~150 bulgu burada listelenemez (token); yerine **tema → faz** eşlemesi + tema referansı verildi. Detay için ilgili agent raporu + bu dokümanın Tema bölümü.

| Tema | Bulgu sayısı | Faz | Sprint hedef |
|---|---|---|---|
| T1 Dedup/idempotency | ~15 | FAZ 2 sprint 1 | EventBus + outbox unification |
| T2 Cross-account isolation | ~10 | FAZ 1 hafta 1 | AuthLifecycle |
| T3 E2EE | ~5 | FAZ 1 (A) / FAZ 3 (B) | Karar + uygulama |
| T4 Firestore rules / KVKK | ~12 | FAZ 1 hafta 1 + FAZ 2 sprint 2 | Pending invite + emulator test |
| T5 Native iOS BLE | ~8 | FAZ 0 + FAZ 1 hafta 2 | State machine + restoration |
| T6 AppState lifecycle | ~6 | FAZ 0 + FAZ 1 | Dual-fire + AuthGate |
| T7 Notification mimarisi | ~10 | FAZ 1 hafta 1 | FCM bg + entitlement |
| T8 On-device EEW | ~7 | FAZ 1 hafta 2 (UX honest) + FAZ 3 (algorithm) | Countdown kaldır |
| T9 Background services iOS | ~4 | FAZ 1 (honest UX) + FAZ 3 (BGTask) | Pazarlama dil |
| T10 Observability | ~8 | FAZ 1 hafta 2 (Sentry) + FAZ 2 sprint 2 (OTel) | Sentry + SLO |
| T11 Test coverage | ~6 | FAZ 2 sprint 3 + ongoing | Maestro + emulator |
| T12 Architectural drift | tüm app | FAZ 2 sprint 3 (pilot) + FAZ 3 (full) | DDD incremental |
| Pre-existing (P0 defer) #15 #16 | 2 | FAZ 2 sprint 2 | Rules emulator + CF |

---

## 6. ELITE ENGINEERING PRENSİPLERİ (kültür/süreç)

### Günlük

1. **Her commit = bir mantıksal değişiklik** (atomic). Mesaj `type(scope): summary` (Conventional Commits).
2. **Her PR = code review** (kendine bile — `gh pr create` + 1 saat bekle, gözle bak).
3. **Her catch = log + bildiri** (Sentry breadcrumb veya error). Boş catch YASAK.
4. **TODO yerine ticket** — TODO yazıyorsan Linear/GitHub Issue da aç, ID yorumda.

### Haftalık

5. **Pazartesi**: önceki hafta SLO durumu + error budget review.
6. **Cuma**: postmortem (varsa incident) + bu hafta öğrendiklerim yazısı.
7. **Hafta içi**: PR review > yeni feature.

### Sprint (2 hafta)

8. **Sprint başı**: net hedef, ölçülebilir acceptance, risk listesi.
9. **Sprint ortası**: cihaz/dogfooding zorunlu.
10. **Sprint sonu**: retro + ADR güncelleme.

### Çeyrek

11. **Architecture review**: bounded context'lerin sağlığı, tech debt.
12. **Security audit**: external pen-test (yılda 1 minimum).
13. **Roadmap güncelleme**: pazar gerçeği + teknik realite.

### Tooling (eksikse v1.6.4'te kur)

- ✅ TypeScript strict (var)
- ✅ ESLint (var, no-empty-catch ekle)
- ❌ **Sentry full** (DSN + source map + alert routing)
- ❌ **Maestro** E2E (mobile)
- ❌ **Firestore Rules Emulator** test setup
- ❌ **Conventional Commits** lint (commitlint + husky)
- ❌ **PR template** (description + test plan + risk)
- ❌ **GitHub Actions CI**: tsc + eslint + jest + emulator rule test
- ❌ **Renovate/Dependabot** dependency updates
- ❌ **Architecture Decision Records** (`docs/adr/`)
- ❌ **Runbook** her kritik servis için (`docs/runbook/`)

---

## 7. BU HAFTA / GELECEK AY / SONRAKİ ÇEYREK

### Bu hafta (FAZ 0 — 1 gün; sonra FAZ 1 başlat)

1. **Bugün**: FAZ 0 maddelerini bitir (0.1-0.8). 1 gün.
2. **Yarın**: Apple Critical Alerts başvurusu (paralel başlat, 1-4 hafta bekle).
3. **Cuma**: FAZ 1 hafta 1 başla — Privacy & Compliance (T2 + T3 + T4).

### Gelecek ay (FAZ 1 — 2 hafta)

- Hafta 1-2: Privacy + Compliance + Notification altyapı.
- Hafta 3: v1.6.4 EAS build + beta cohort.
- Hafta 4: gözlem + bug fix + App Store submit.

### Sonraki çeyrek (FAZ 2 — 6 hafta + FAZ 3 başlangıç)

- Ay 1: EventBus + Dedup + Outbox unification.
- Ay 2: Rules emulator + Observability + SLO.
- Ay 3: Test coverage + DDD pilot (SOS) + v1.7 ship.

---

## 8. KARAR MATRİSİ — Hangi madde mutlaka, hangi opsiyonel?

| Madde | v1.6.4 (mutlaka) | v1.7 (önemli) | v2.0 (opsiyonel) |
|---|---|---|---|
| E2EE A (label) ya da B (Signal) | A mutlaka | B opsiyonel (etkili) | - |
| Cross-account isolation | ✅ | - | - |
| KVKK PII pending invite | ✅ | - | - |
| Critical Alerts entitlement | başvuru ✅ | uygulama ✅ | - |
| FCM background handler | ✅ | - | - |
| Swift BT state machine + restoration | ✅ | - | - |
| Mesh-SOS dual-fire | ✅ | - | - |
| `trapped` flag erase | ✅ (1sa) | - | - |
| On-device EEW honest UX | ✅ | - | - |
| ShakeAlert algoritma | - | - | ✅ |
| EventBus + Dedup unification | - | ✅ | - |
| Firestore rules emulator + tests | - | ✅ | - |
| Observability (Sentry + OTel + SLO) | Sentry ✅ | OTel + SLO ✅ | - |
| DDD refactor pilot | - | ✅ (SOS) | tüm context'ler ✅ |
| Apple Watch Companion | - | - | ✅ |
| Multi-language (AR) | - | - | ✅ |

---

## 9. RİSK DEĞERLENDİRME

### En yüksek risk (bunlar çözülmezse zarar)

1. **KVKK PII disclosure** (pending invite) → ceza + güven kaybı. **v1.6.4 mutlak.**
2. **"E2EE" yalan iddia** → KVKK + tüketici kanunu. **v1.6.4 mutlak (en azından label change).**
3. **Killed app SOS sessiz fail** → afet anında telefonla ulaşılamaz. **v1.6.4 (FCM bg) + v1.7 (BLE restoration).**
4. **Critical Alerts yok** → EEW DND'de duyulmaz. **Apple onayı 1-4 hafta paralel.**
5. **Cross-account state leak** → User B, User A'nın verisini görür. **v1.6.4 mutlak.**

### Orta risk

6. Mesh SOS notification UX (background → görmez) — düzeltildi ama regression olabilir.
7. EEW dedup 2x notification — UX kalitesi.
8. Account deletion v3 path eksik — KVKK Madde 7 (right to be forgotten).

### Düşük risk

9. Çoğu MEDIUM/LOW finding — gözlem + sprint planla.

---

## 10. KAPANIŞ

Bu uygulama **1.5 yılda solo dev tarafından life-critical scope'ta** yazıldı. Bu noktada eksikliklerin var olması **normal** ve **düzeltilebilir**. Önemli olan:

1. **Dürüstlük**: Pazarlama dilini gerçekle hizala (E2EE, 7/24).
2. **Sıralama**: Hukuki riski önce, mimari refactor sonra.
3. **Sürdürülebilirlik**: Solo dev için bile observability + test = future-self için hediye.

Bu plan **6 ay sonra** uygulanırsa AfetNet:
- KVKK uyumlu, hukuki güvende
- Elite-grade dedup + observability
- Killed-app mesh SOS gerçek anlamda çalışan
- Honest UX, gerçekçi pazarlama
- Test coverage 80%+ kritik path'lerde

**Bir sonraki adım:** FAZ 0'a başla (bugün, 1 gün). Sonra FAZ 1 hafta 1'in T2 (cross-account isolation) ve T4 (KVKK PII) maddeleri.

---

**Belge versiyonu:** 1.0
**Yazım tarihi:** 2026-05-23
**Bir sonraki güncelleme:** FAZ 0 bitince, FAZ 1 maddesi tamamlandıkça.
