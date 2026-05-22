# AfetNet v1.6.3 — Uygulama Durum Raporu

> 12-uzman audit'i (`reports/AUDIT-v1.6.3.md`) ve ultra plan
> (`docs/ULTRA-PLAN-v1.6.3.md`) doğrultusunda yapılan implementasyonun
> durumu. Tarih: 2026-05-21.

---

## ÖZET

**5 faz işlendi · 35+ iş paketi tamamlandı.** Quality gate'ler:
TypeScript temiz · Lint temiz · **344 test PASS (39 suite)** · functions tsc temiz ·
Firestore/RTDB kuralları doğrulandı.

---

## TAMAMLANAN

### Faz 1 — Crash & Store Blocker
- **VoiceCall özelliği tamamen kaldırıldı** — 4 dosya silindi, 11 dosya temizlendi, `react-native-webrtc` bağımlılığı + Firestore `voice_calls` kuralları söküldü
- **Privacy Manifest** — `NSPrivacyCollectedDataTypeHealth` eklendi (Apple reject blocker'ı)
- **App stabilite** — authStore/onboardingStore subscribe guard'larına `prevState` koruması, App.tsx retry path'ine 35sn güvenlik zamanlayıcısı, AI SSE çağrısına tam `AbortController` zinciri
- **Release prosedürü** — `eas.json` Android submit profili, RELEASE_CHECKLIST v1.6.3 + staged rollout
- *False positive ayıklandı:* Android foreground service crash + iOS ATT/IDFA — doğrulamada gerçek olmadığı tespit edildi, gereksiz değişiklikten kaçınıldı

### Faz 2 — Exploit & Veri Sızıntısı
- Backend `onSeismicReportCreated` Sybil dedup sıkılaştırması
- `eewWebhook` + `eewEmergencyTrigger` — SHA-256 hash ile sabit-zamanlı API key karşılaştırması (uzunluk-oracle kapatıldı); `openAIChatProxy` wildcard CORS kaldırıldı
- Firestore: `users` list→admin, `devices` ownership-hijack, `families` grup-ele-geçirme, `seismicDetections` immutable, `news_summary_jobs` sonsuz-lock, RTDB `rate_limits` bypass
- **Sağlık verisi sızıntısı (gerçek P0)** — `broadcastPacket` `gated` parametresini işlemiyordu → fail-closed yapıldı
- `CryptoService` — güvenli depolama yoksa private key düz yazma engellendi

### Faz 3 — SOS Doğruluk & Test
- SOS rate-limit atomik blok (spam koruması)
- SOS dürüstlük banner'ı ("112'nin yerini tutmaz" / "hiçbir kanaldan ulaşılamıyor")
- GPS (0,0) "Null Island" guard
- **75 yeni kritik test** — MultiSourceEEWService (44) + AccountDeletionService (31)

### Faz 4 — Compliance
- COPPA yaş kapısı (onboarding 13+ beyanı)
- Analytics consent-gating (varsayılan kapalı, opt-in)
- AI consent doğrulandı (mevcut `promptAiConsent` yeterli)
- **GDPR/KVKK veri export** — yeni `exportUserData` Cloud Function
- KVKK Aydınlatma Metni taslağı (`docs/KVKK-AYDINLATMA-METNI.md`)
- Hesap silme cascade test ile doğrulandı

### Faz 5 — P1 Sağlamlaştırma
- ProGuard keep rules (BLE + Firebase)
- `USE_FULL_SCREEN_INTENT` izni + notification channel `bypassDnd`
- Android manifest hijyeni (legacy BLE permission guard, `WRITE_SETTINGS`/`SYSTEM_ALERT_WINDOW`/storage izinleri temizliği)
- iOS buildNumber 6→36 senkron
- `families` tam üye-düzeyi yetkilendirme + `hasAcceptedContactRequest` mutual-link (P1-2)
- SOS broadcast fan-out pagination (1M cihaz kapasitesi)
- Composite index'ler + SMTP Secret Manager
- Türkçe karakter düzeltmeleri (EditMemberModal, SOSHelpScreen)
- EEW AI-tahmin vs resmi-uyarı UI ayrımı (badge)
- ConversationScreen jank fix (konuşmaya özel selector)

---

## KALAN İŞLER

### A. Kullanıcı aksiyonu gerektiren
| İş | Açıklama |
|---|---|
| WP-1.5 Crashlytics | `npm install @react-native-firebase/crashlytics@23.8.6` → sonra servis + config bağlanır |
| Apple Critical Alerts | Developer Portal'da capability başvurusu (1-4 hafta) |
| OpenAI / Crashlytics DPA | GDPR Art.28 veri işleme sözleşmeleri |
| Backup retention | Firebase Console'da bucket 30-gün TTL lifecycle |
| KVKK metni | `docs/KVKK-AYDINLATMA-METNI.md` hukuki onay + `[alanlar]` doldurma |
| CI secret + Detox | GitHub Actions workflow + EAS secret'ları |

### B. Faz 6 — Yayın (kullanıcı yürütür)
1. Tüm değişiklikleri commit → CI yeşil
2. `npx expo prebuild --clean` (native değişiklikler: manifest, ProGuard, buildNumber, Privacy Manifest)
3. `eas build -p ios/android --profile production`
4. RELEASE_CHECKLIST.md cihaz smoke testleri — **özellikle v1.6.2→1.6.3 upgrade testi**
5. Backend deploy: `firebase deploy --only functions,firestore:rules,firestore:indexes,database` + `firebase functions:secrets:set SMTP_PASSWORD`
6. Staged rollout (iOS phased %1→%100, Android %10→%100), crash-free >%99.5 izle

### C. Sonraki sürüme ertelenen (mimari / L-efor)
| İş | Sebep |
|---|---|
| WP-2.5 MMKV iki-katmanlı şifreleme | Senkron storage mimarisi refactoru — izole, dikkatli oturum gerekir (CryptoService private-key koruması bu sürümde yapıldı) |
| WP-2.6 BLE broadcast ECDH | Mesh protokol değişimi + v1.6.2 sürüm uyumu → v1.6.4 |
| WP-5.12 Cert pinning | Native network katmanı — L efor → v1.6.4 |
| WP-5.6 Asset sıkıştırma | Build pipeline işi (premium görseller → WebP) |
| WP-5.7 Background konum minimization | Konum task'ı yalnızca paylaşım/SOS açıkken çalışsın — useLiveLocation refactoru |
| WP-5.11 AI streaming feature flag | SSE WP-1.6'da abort-safe yapıldı; build-time flag düşük öncelik |
| Mesh `sendToPeer` directed transport | Sağlık paylaşımı şu an fail-closed; mesh directed transport eklenmeli |

---

## YAYIN KARARI

**Faz 1-5 P0/P1 kod işi tamamlandı.** Yayın için kalan zorunlu adımlar:
1. WP-1.5 Crashlytics (production crash görünürlüğü — kör uçuş riski)
2. Faz 6: prebuild + EAS build + cihaz smoke + backend deploy
3. Apple Critical Alerts başvurusu (paralel — onaysız yayın mümkün ama EEW kritik-alert vadetme)

**Audit'teki tüm P0'lar kapatıldı veya gerekçeli ertelendi.** Sıfır blocker
kod tarafında kalmadı — kalan her şey kullanıcı/operasyon aksiyonu.

---

*Uygulama Durum Raporu · AfetNet v1.6.3 · 2026-05-21*
