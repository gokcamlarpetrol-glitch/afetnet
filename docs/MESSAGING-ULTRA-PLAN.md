# AfetNet Mesajlaşma — ULTRA PLAN (Hardening Program) · v2

> 20 bulgu (M1-M9 offline BLE mesh · O1-O9 online Firebase chat) için tam
> mühendislik planı. Kaynak: 3 elite uzman fix-design + Principal Developer
> sentezi + **5× review** (Pass 1 self · Pass 2 güvenlik · Pass 3 QA/regresyon ·
> Pass 4 revizyon · Pass 5 final).
>
> **Tarih:** 2026-05-21 · **Durum:** v2 — 22 review bulgusu işlendi · kullanıcı onayı bekliyor.
> **Kural: Bu plan onaylanmadan tek satır kod yazılmaz.**

---

## 0. İlkeler

- **Sıfır regresyon hedefi.** Her WP sonrası: ana `tsc` + functions `tsc` + etkilenen test + bağımlı dosya kontrolü + (mesh/SOS/EEW'e dokunduysa) **çapraz-özellik regresyon kapısı** (§6).
- Hayati yazılım — "type-check yeşil" ≠ "bitti". Mesh fix'leri unit test + iki-cihaz doğrulaması ister.
- Her WP'de **kök neden gerçek kodda yeniden doğrulanır** — bu plandaki satır no'ları fix-design turundan gelir, stale olabilir (review bulgusu G1); uygulama anında re-grep zorunlu.
- Kısa yol yok. Bağımlılık sırası katı.

## 1. Deploy ayrımı — sıralamanın temeli

| Katman | Değişen | Yayın | Eski binary korur? |
|---|---|---|---|
| **Server** | `firestore.rules`, `functions/src/*` | `firebase deploy` (scoped) — anında | ✅ EVET |
| **Client** | `src/**/*.ts(x)`, native modüller | yeni app build (EAS) + store | ❌ yeni sürüm |

→ Server-side fix'ler önce ve hızlı — eski sürümdeki kullanıcıyı bile anında korur.
→ O6 deploy'u **scoped olmalı**: `firebase deploy --only functions:onNewConversationMessageV3,firestore:rules` — yoksa `SMTP_PASSWORD` secret blokajına girer (bkz. EEW deploy deneyimi).

---

## 2. Faz haritası

### FAZ 0 — Test altyapısı · ÖN KOŞUL (review G2/G3)
| WP | İş | Gate |
|---|---|---|
| **A0** | Rules test harness: `@firebase/rules-unit-testing` kur, `firebase.json` emulator bloğu, ayrı jest projesi (jest-expo emulator testinde boğulur), CI wiring | FAZ A öncesi |
| **B0** | Mesh test scaffold: fake-BLE transport + çok-düğüm harness (M3'ün "20-30 düğüm simülasyonu" bu olmadan doğrulanamaz) | FAZ B öncesi |

### FAZ A — Server-side hardening · app build YOK · A0 sonrası
| WP | Bulgu | Önem |
|---|---|---|
| O2 | Grup üyelik kuralı — kurucu onaysız üye ekliyor, üye çıkamıyor | HIGH |
| O6 | Engelleme yalnızca istemcide — CF engellemeyi uygulamıyor | MEDIUM |
| O9 | Legacy `devices/{id}/messages` create herkese açık | LOW→MED |

### FAZ B — Mesh hardening · client · app build · B0 sonrası
**Wave B1 — paket-formatı temeli (birlikte tasarlanır):**
| WP | Bulgu |
|---|---|
| M1 | Protokol v3: imzalı paket + gerçek anahtar değişimi + versiyon pinning |
| M9 | Chunk ID genişletme + reassembly bellek sınırı + sessiz hata kaldır |
| M3 | Relay jitter + sayaç-tabanlı bastırma + zaman-sınırlı dedup |
| M6a | Online↔offline **sync sırası** (timestamp) — bağımsız parça |

> **Birleşik mesaj-kimliği tasarımı (review Pass-1 #3):** M1 (imzalı paket kimliği) + M9 (chunk reassembly anahtarı) + M5 (içerik-türevi messageId) — üçü tek tutarlı "mesaj kimliği + paket formatı" alt-tasarımına uymalı. B1 başında bu alt-tasarım yazılır, M5 ona uyar.

**Wave B2 — B1'e bağımlı:**
| M4 | `sentChunkCache` persist + `relayQueue` bayat-replay durdur |
| M5 | İçerik-türevi kararlı broadcast `messageId` + peer-başına teslimat |
| M6b | Bridge echo-guard — kararlı kimliğe çevir (M1'e bağımlı, review G4) |

**Wave B3 — M3'e bağımlı:**
| M7 | SOS transmit-confirmation + kritik kuyruk drain + dedup eviction |
| M8 | Kompakt SOS beacon + sahtecilik karşıtı (review GAP-2) |

**Native track — 1. günden paralel:**
| M2 | Android foreground service + iOS CBCentralManager state-restoration |

### FAZ C — Online client fixes · client · app build (B ile aynı sürüm)
| WP | Bulgu | Sıra |
|---|---|---|
| O3 | Çift Firestore mesaj listener'ı kaldır | önce |
| O7 | Receipt doğruluğu | O3 sonrası (aynı dosya) |
| O8 | Teslim-garanti gating | **O7 sonrası** (review G5 — ortak state machine) |
| O5 | Sessiz düzenle/sil hatasını yüzeye çıkar | bağımsız |
| O4 | Cursor sayfalama | O3 sonrası, en büyük UI işi |

### FAZ D — O1 şifreleme · AYRI döngü · kullanıcı kararı gerekir
| O1 | Mesaj at-rest şifreleme — Option A vs B; staged rollout |

---

## 3. Work Package detayları

### FAZ 0

**A0 — Rules test harness** · `firebase.json`, `package.json`, jest config, CI
- *Neden:* O2/O6/O9 doğrulaması `@firebase/rules-unit-testing` (MIT) gerektirir — kurulu değil, emulator bloğu yok (G2).
- *İş:* paketi devDependency ekle; `firebase.json`'a `emulators.firestore`; rules testleri için ayrı jest projesi (jest-expo preset emulator testinde boğulur); örnek pozitif/negatif test; CI'ye ekle.
- *Efor:* 0.5-1 gün. *Gate:* FAZ A.

**B0 — Mesh test scaffold** · `src/core/services/mesh/__tests__/`
- *Neden:* Tek önemsiz mesh testi var (`MeshProtocolCompatibility.test.ts`); M1/M3/M5/M7/M8/M9 "unit test" + "çok-düğüm simülasyonu" vaat ediyor — altyapı yok (G3).
- *İş:* fake-BLE transport (deterministik), N-düğüm simülasyon harness'i (paket sayımı, hop, dedup metriği), test util'leri.
- *Efor:* 2-4 gün. *Gate:* FAZ B (Wave B1).

### FAZ A — Server-side

**O2 — Grup üyelik kuralı** · HIGH · `firestore.rules:250-264`
- *Kök neden:* `isConversationMembershipUpdate()` yalnızca `createdBy == auth.uid` kontrol ediyor → kurucu onaysız üye ekler; kurucu-olmayan çıkamaz.
- *Fix — yeni fonksiyon gövdesi (review GAP-4, tam kod):*
  ```
  function isConversationMembershipUpdate() {
    return resource.data.type == 'group'
      && request.resource.data.type == resource.data.type
      && request.resource.data.createdBy == resource.data.createdBy   // immutable
      && request.resource.data.createdAt == resource.data.createdAt   // immutable
      && resource.data.createdBy in request.resource.data.participants // kurucu kalır
      && request.resource.data.participants is list
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['participants','participantNames','participantDeviceIds','updatedAt'])
      && (
        resource.data.createdBy == request.auth.uid                   // (a) kurucu yönetir
        || (                                                          // (b) yalnızca KENDİ ayrılışı
          request.auth.uid in resource.data.participants
          && !(request.auth.uid in request.resource.data.participants)
          && resource.data.participants.removeAll([request.auth.uid])
             == request.resource.data.participants
        )
      );
  }
  ```
  Self-JOIN (davetsiz katılma) kasıtlı **dışarıda** — `pendingParticipants` + accept akışı faz 2.
- *Regresyon:* meşru kurucu ekle/çıkar geçmeli; grup-rename `isConversationMetadataUpdate`'ten gider.
- *Doğrulama:* rules-unit-test — kurucu ekler→allow; kurucu-olmayan 3.kişi ekler→deny; kurucu-olmayan kendini çıkarır→allow; başkasını çıkarır→deny; `createdBy` değişir→deny.
- *Efor:* 3-5 saat.

**O6 — CF engelleme uygulaması** · MEDIUM · `functions/src/messaging.ts`
- *Kök neden:* Engelleme listesi `users/{uid}/blocked/{id}`'de; mesaj-create kuralı + CF push fan-out engellemeyi kontrol etmiyor.
- *Fix:* `onNewConversationMessageV3` push öncesi her `recipientUid` için `users/{recipientUid}/blocked/{senderUid}` oku — varsa o alıcının push + inbox-bump'ını atla. Admin SDK, invocation-cache. Grup: yalnızca o çifti atla, grubu değil.
- *Bağımlılık notu:* Bildirim-sistemi denetimi (ayrı stream) push fan-out'a dokunuyor — O6 ve O1 onunla koordine edilmeli, iki plan CF push'u farklı düzenlememeli (review G8).
- *Regresyon:* alıcı-başına ekstra okuma → invocation-cache ile sınırla.
- *Efor:* 4-8 saat.

**O9 — Legacy inbox kuralı** · LOW→MED · `firestore.rules:481-502`
- *Kök neden:* Herhangi bir kimlikli kullanıcı herhangi bir cihazın `devices/{id}/messages`'ına yazabiliyor.
- *Fix — yeniden kapsam (review G7):* grep canlı yazıcılar gösteriyor (`HybridMessageService.ts:3053`, `FirebaseDataService.ts:777/818/1034`, `FirebaseDeviceOperations.ts:102`) → "false yap" geçersiz. Doğru fix: create'i `isDeviceOwner(deviceId) || isLinkedFamilyMember(deviceId)` + `isRecentClientTimestamp`'e sıkılaştır. Önce bu çağrı yollarının gerçekten canlı mı yoksa ölü kod mu olduğunu teyit et.
- *Regresyon:* eski binary hâlâ yazıyorsa sıkılaştırma kırar — telemetri/çağrı-yolu denetimi şart.
- *Efor:* 4-6 saat (yeniden tahmin).

### FAZ B — Mesh

**M1 — Protokol v3: imzalı paket + anahtar değişimi + versiyon pinning** · CRITICAL · `src/core/services/mesh/{MeshProtocol,MeshCryptoService,MeshNetworkService}.ts`
- *Kök neden:* `handleKeyExchange`/`onKeyExchange` ölü kod; `encryptBroadcast` simetrik anahtarı pakette gönderiyor; imza yok → sahte SOS.
- *Fix:* (1) Çift keypair — `nacl.box` (var) + `nacl.sign` Ed25519 (yeni). **Ed25519 imza anahtarı DEVİCE-KALICI, asla dönmez** (SecureStore, ayrı kayıt) — kararlı kimlik; box anahtarı forward-secrecy için 24 saatte döner (review GAP-3). (2) Her v3 pakete 96-byte imzalı trailer; v3 bad-signature → düşür. (3) Bağlı peer: GATT connect'te `KEY_EXCHANGE` → `handleKeyExchange` → session key → `ENC_PEER` aktif. (4) Broadcast: sahte `{_enc,k}` zarfını kaldır → imzalı düz metin.
- *Versiyon downgrade savunması (review GAP-1/G11 — KRİTİK):* `MeshProtocol.deserialize`'da versiyon kontrolü şu an yorum satırı. Eklenecek: `highestVersionSeen[sourceId]` — bir peer v3 imzalı paket gönderdiyse, o `sourceId`'den gelen v2 (imzasız) paketler **reddedilir** (downgrade saldırısı). Hiç görülmemiş peer'dan v2 → `verified:false`, ve **UI sözleşmesi:** doğrulanmamış SOS asla otantik gösterilmez / tek başına aksiyon ("Geliyorum") tetiklemez — korroborrasyon şartı. Karışık-sürüm penceresinde artık-risk açıkça kabul edilir; v3-only cutover tetiği telemetriye bağlanır (↓).
- *Telemetri (review G9):* `verified:false` paket sayacı — sahada kaç imzasız paket var ölçülmeden v3-only'ye geçilemez.
- *Dosyalar:* tam yollar `src/core/services/mesh/MeshProtocol.ts`, `MeshCryptoService.ts`, `MeshNetworkService.ts`.
- *Regresyon:* +96 byte → 31-byte advertising kırılır → imzalı SOS GATT/chunk yolundan (M8 ile koordine); Ed25519 sub-ms.
- *Doğrulama:* B0 harness — sign/verify round-trip; forge denemesi fail; v2-downgrade reddi; KEY_EXCHANGE iki örnek aynı `sharedSecret`.
- *Efor:* 3-5 gün. *Bağımlılık:* M9 ile birleşik kimlik tasarımı. Wave B1.

**M9 — Chunk ID + reassembly sınırı + sessiz hata** · MEDIUM · `src/core/services/mesh/MeshNetworkService.ts`
- *Kök neden:* `chunkForGATT` 16-bit `messageId & 0xFFFF` → çakışma; `chunkReassembly` bellek sınırsız; sessiz catch'ler.
- *Fix:* reassembly'yi tam 32-bit `meshMessageId` (header'da var) üzerinden anahtarla; `chunkReassembly` cap (max N + max byte); hot-path sessiz catch'leri rate-limited log'a çevir.
- *Doğrulama:* B0 harness — iki eşzamanlı çok-chunk mesaj bütün; malformed fuzz loglanır; flood bellek sınırı tutar.
- *Efor:* 1.5-2.5 gün. *Bağımlılık:* M1 ile birleşik kimlik tasarımı; M4/M5'i açar. Wave B1.

**M3 — Relay jitter + bastırma + zaman-sınırlı dedup** · HIGH · `src/core/services/mesh/MeshNetworkService.ts`
- *Kök neden:* jitter'sız relay; dedup LRU 5000 ile sınırlı, taşmada yeniden relay; her PING'de yeniden teslimat.
- *Fix:* relay öncesi rastgele jitter (100-800ms; CRITICAL ~50-150ms); jitter penceresinde ≥N kopya görülürse relay iptal; dedup'a zaman sınırı (>10dk) + cap ~20000; per-`messageId` relay-once guard.
- *Doğrulama:* B0 harness 20-30 düğüm — mesaj başına BLE yazımı sub-lineer; SOS tüm hop'lara ulaşır.
- *Efor:* 1.5-3 gün. *Bağımlılık:* M7/M8 ön-koşulu. Wave B1.

**M6 — Sync sırası (M6a) + bridge echo-guard (M6b)** · HIGH · `src/core/services/OfflineSyncService.ts`, `src/core/services/mesh/MeshMessageBridge.ts`
- *Kök neden:* sync yalnızca öncelikle sıralı → sırasız; bridge 5000-cap LRUSet → echo.
- *Fix M6a (Wave B1, bağımsız):* `(priority desc, timestamp asc)` sırala.
- *Fix M6b (Wave B2, review G4 — M1'e bağımlı):* bridge echo-guard'ı M1'in kararlı kimliğine çevir + persist et; round-trip mesaj tanınır. Tip-başına LWW (mesaj: sunucu timestamp otoriter).
- *Doğrulama:* 10 mesaj sırasız kuyruğa → Firestore sırası gönderim sırasıyla; mesh→cloud round-trip → echo yok.
- *Efor:* M6a 0.5 gün, M6b 1-1.5 gün.

**M4 — sentChunkCache persist + relayQueue replay durdur** · HIGH · `src/core/services/mesh/MeshNetworkService.ts`
- *Kök neden:* `sentChunkCache` bellek-içi → app kill sonrası parçalı mesaj başarısız; `relayQueue` persist+replay → bayat TTL.
- *Fix:* `sentChunkCache`'i `DirectStorage` ile persist et (byte cap + TTL evict); `relayQueue`'yu persist etme.
- *Doğrulama:* chunked transfer ortada app kill, yeniden aç, NACK → retransmit; >30dk eski relay replay edilmez.
- *Efor:* 1-2 gün. *Bağımlılık:* M9 ile şema hizalı. Wave B2.

**M5 — Kararlı broadcast messageId + peer-başına teslimat** · HIGH · `src/core/services/mesh/MeshStoreForwardService.ts`
- *Kök neden:* `storeForPeer` her store'da `Math.random()` ID → alıcı dedup tutmuyor → çift teslimat.
- *Fix:* `messageId` içerik-türevi (M1+M9 birleşik kimlik tasarımına uyumlu hash); peer-başına teslimat durumu.
- *Doğrulama:* iki cihaz, peer sık girip çıkıyor → her broadcast tam bir kez.
- *Efor:* 1.5-2.5 gün. Wave B2.

**M7 — SOS transmit-confirmation + kritik drain** · HIGH · `src/core/services/mesh/MeshNetworkService.ts`, `src/core/services/sos/SOSChannelRouter.ts`
- *Kök neden:* SOS 8sn timeout fire-and-forget; döngü başına max 5 kritik; taşmada en yeni düşer.
- *Fix:* `broadcastMessage` SOS için enqueue receipt + gerçek transmit-confirmation callback ("queued/transmitted/delivered"); kritik kuyruk doluysa tüm kritikleri drain et; eviction SOS `messageId` dedup ile, asıl distress paketini asla düşürme.
- *Regresyon:* `SOSChannelRouter` SOS özelliğiyle paylaşımlı — **çapraz-özellik kapısı zorunlu** (§6).
- *Doğrulama:* SOS tetikle → transmit-confirmation; 1000 paket flood → asıl SOS hayatta.
- *Efor:* 2-3 gün. *Bağımlılık:* M3 önce. Wave B3.

**M8 — Kompakt SOS beacon + sahtecilik karşıtı** · MEDIUM · `src/core/ble/HighPerformanceBle.ts`, `src/core/services/mesh/MeshProtocol.ts`
- *Kök neden:* SOS JSON >31 byte → advertising fallback hiç çalışmıyor; bağlı peer yokken SOS kuyrukta bekler.
- *Fix:* kompakt 31-byte SOS beacon (magic + sourceId + 9-byte SOS payload). **Sahtecilik karşıtı (review GAP-2):** 96-byte imza 31 byte'a sığmaz → beacon doğal olarak imzasız. İki seçenek, plan **(a)**'yı seçer: (a) beacon **salt-danışma** — UI'da açıkça "doğrulanmamış yakınlık sinyali — kimlik teyitli değil", asla tek başına aksiyon (dispatch) tetiklemez, GATT'tan imzalı paket gelene kadar yalnızca ipucu. (b) [reddedildi — karmaşık] 4-byte HMAC.
- *Regresyon:* advertising kanalı EEW/seismic beacon ile paylaşımlı olabilir — **çapraz-özellik kapısı zorunlu** (§6); alıcı beacon'ı paketten ayırt etmeli.
- *Efor:* 1.5-2.5 gün. *Bağımlılık:* M3. Wave B3.

**M2 — Android foreground service + iOS state-restoration** · CRITICAL · `src/core/services/mesh/BackgroundMeshService.ts`, `app.config.ts`, `modules/afetnet-ble-peripheral/ios/*`
- *Kök neden:* `startAndroidForegroundService` placeholder; iOS arka planda loop duruyor.
- *Fix Android:* gerçek foreground service — custom Expo config plugin (`<service foregroundServiceType="connectedDevice">` + `FOREGROUND_SERVICE_CONNECTED_DEVICE` izni). `pauseForBackground`'ı `Platform.OS` ile gate'le. Config plugin → `expo prebuild` + native rebuild gerektirir.
- *Fix iOS (DÜRÜST — yalnızca kısmi):* tam çözüm YOK. CoreBluetooth State Preservation & Restoration ile pasif tarama+advertising + peer'a uyanma korunur; sürekli çok-hop JS relay iOS arka planında çalışamaz (OS sınırı). UI'da dürüstçe belirt.
- *Regresyon:* kalıcı bildirim / Play Store foreground-service denetimi (mitigasyon: yalnızca mesh açık/SOS aktifken); pil; iOS BLE çift-init.
- *Doğrulama:* Android — kilitli telefon iki-cihaz relay sayacı; `dumpsys`. iOS — arka plan SOS uyanma. Pil: 1 saat <%5.
- *Efor:* Android 2-3 gün; iOS 2-4 gün; en kötü 8 gün. Native track, 1. günden paralel.

### FAZ C — Online client

**O3 — Çift mesaj listener'ı kaldır** · HIGH · `src/core/screens/messages/ConversationScreen.tsx`
- *Fix:* doğrudan `setupDirectSubscription` bloğunu kaldır; ekran zaten `refreshCloudSubscriptions()` çağırıyor. **Önce doğrula:** global sub push'tan cold-start konuşmayı kapsıyor mu — kapsamıyorsa `hasListenerFor(convId)` koşulu ekle.
- *Doğrulama:* gelen mesaj başına `addMessage` = 1; cold-start push hâlâ gösterir.
- *Efor:* 3-6 saat. *Bağımlılık:* O4/O7/O8'den önce.

**O7 — Receipt doğruluğu** · MEDIUM · `src/core/screens/messages/ConversationScreen.tsx`
- *Fix:* `deriveReceiptState`'te `|| !options.isFromMe` fallthrough + force-bloğunu kaldır; teslimat yalnızca sunucu `deliveredTo`'dan türesin.
- *Efor:* 2-4 saat. *Bağımlılık:* O3 sonrası.

**O8 — Teslim-garanti gating** · MEDIUM · `src/core/services/HybridMessageService.ts`, `src/core/services/ConnectionManager.ts`
- *Fix:* başarı kapısını `null` olabilen `isOnline`'dan çıkar — `outcome.status === 'full_success'`'e güven; `isInternetReachable===null` → "online/bilinmiyor", asla "offline".
- *Regresyon:* teslimat çekirdeği — O7 ile ortak receipt/delivery state machine; **O7 sonrası tek seferde doğrula** (review G5).
- *Efor:* 4-8 saat. *Bağımlılık:* **O7 sonrası**.

**O5 — Sessiz düzenle/sil hatasını yüzeye çıkar** · MEDIUM · `src/core/services/firebase/FirebaseMessageOperations.ts` + caller'lar
- *Fix:* `Result<void,Error>` dön; başarısızlıkta optimistic-UI geri al + Türkçe Alert.
- *Efor:* 3-5 saat. *Bağımlılık:* bağımsız.

**O4 — Cursor sayfalama** · MEDIUM · `src/core/services/firebase/FirebaseMessageOperations.ts`, `src/core/screens/messages/ConversationScreen.tsx`
- *Fix:* `loadMessagesBefore(convId, cursor, pageSize)` — `startAfter` cursor; realtime tail 100 kalır; "Daha fazla" prepend.
- *Regresyon:* prepend scroll-offset → `maintainVisibleContentPosition`; tail+geçmiş çakışması → `_messageIdSet` dedup.
- *Efor:* 1-2 gün. *Bağımlılık:* O3 sonrası.

### FAZ D — Şifreleme (ayrı döngü)

**O1 — Mesaj at-rest şifreleme** · HIGH · çok dosya · **KULLANICI KARARI**
- *Seçenekler:*
  - **A — Gerçek E2E:** sunucu içeriği hiç görmez. Efor 3-6 hafta.
  - **B — Envelope encryption:** konuşma-başına AES-256-GCM. **Dürüst tehdit-modeli (review GAP-5):** sarmalı anahtarlar da Firestore'da → Admin SDK'lı her Cloud Function düz metni okuyabilir. B yalnızca **ham DB export / depolama-katmanı ihlaline** karşı korur; "sunucu/backend içeriği okuyamasın" tehdidini yalnızca A karşılar.
- *Telemetri (review G9):* remote-config flag + min-version cutover ölçülebilir olmalı.
- *Efor:* B 4-7 gün (en kötü 12) / A 3-6 hafta. Ayrı sürüm döngüsü.

---

## 4. Yeni paket & lisans

| İhtiyaç | Çözüm | Lisans |
|---|---|---|
| M1 imzalama | `tweetnacl` — **zaten kurulu** | MIT ✓ |
| M2 Android FG service | custom Expo config plugin (**paket yok**) / alt: `expo-foreground-actions` | MIT ✓ |
| O1 şifreleme | `expo-crypto` (**zaten kurulu**) / `react-native-quick-crypto` | MIT ✓ |
| A0 rules testi | `@firebase/rules-unit-testing` (devDependency) | MIT ✓ |

→ **Hiçbir GPL/AGPL yok.** M2 plugin + O1 paket kararını onaylaman gerekir.

## 5. Kullanıcı kararları (kodlama ÖNCESİ)

1. **O1 şifreleme:** Option A (gerçek E2E, 3-6 hafta) vs B (envelope, 4-7 gün — yalnızca DB-ihlaline karşı korur).
2. **M2:** Android config plugin onayı + iOS arka plan sınırının (sürekli relay yok) kabulü.
3. **Faz sırası:** FAZ 0 → A (server, hemen) → B+C (tek app build) → D (ayrı).

## 6. Regresyon stratejisi — sıfır-regresyon

- Her WP sonrası: `npx tsc --noEmit` + `cd functions && npm run build` + `npm test` (etkilenen).
- Rules (O2/O6/O9): A0 harness ile pozitif+negatif test → deploy ÖNCESİ yeşil.
- Mesh paket-formatı (M1/M9): protokol v3 + versiyon pinning; eski binary `verified:false` kabul, downgrade reddi.
- **Çapraz-özellik regresyon kapısı (review G6 — senin "başka yeri bozma" şartın):** M1, M7, M8 sonrası — SOS akışını uçtan uca çalıştır + EEW advertising'in bozulmadığını doğrula. `.detoxrc.json` mevcut → ilgili Detox spec'leri adlandırılıp koşulur. Mesh fix'i bitince SOS + EEW + family tracking smoke testi zorunlu.
- Bağımlılık sırası katı: A0→A; B0→B1; M1+M9 birleşik→(M4,M5,M6b); M3→(M7,M8); O3→(O7→O8, O4).
- "tsc yeşil" ≠ "bitti" — mesh fix'leri **iki fiziksel cihaz** doğrulaması ister (M5/M7/M8/M2). Cihaz yoksa B0 simülasyonu + sınırlı kapsam — kullanıcı teyidi gerekir.

## 7. Dürüst timeline (review G10 — yeniden hesaplandı)

| Faz | Süre |
|---|---|
| FAZ 0 (A0+B0) | 3-5 gün |
| FAZ A | 1.5-2 gün |
| FAZ B (B1-B3 + M2 paralel) | 4-6 hafta |
| FAZ C | 3-5 gün |
| **FAZ 0+A+B+C toplam** | **~6-8 hafta** mühendislik |
| FAZ D (O1) | B: 4-7 gün / A: 3-6 hafta — ayrı |

> v1'deki "4-6 hafta" test altyapısını (FAZ 0) ve çapraz-özellik doğrulamasını saymıyordu — düzeltildi. İki-cihaz doğrulaması takvim kısıtı, yalnızca efor değil.

## 8. Work-package doğrulama protokolü

Her WP, istisnasız:
1. Kök nedeni gerçek kodda **re-grep ile** yeniden doğrula (satır no'ları stale olabilir).
2. TEK minimal fix.
3. `tsc` (ana+functions) + etkilenen test → yeşil.
4. Bağımlı dosya + (mesh/SOS/EEW dokunduysa) çapraz-özellik kapısı.
5. WP "tamamlandı" — sonraki WP.
3 fix başarısız → DUR, varsayımı terk et, sıfırdan teşhis.

---

*Mesajlaşma Ultra Plan v2 · AfetNet · 2026-05-21 · 3 elite uzman + Principal Developer + 5× review (22 bulgu işlendi) · kullanıcı onayı bekliyor*
