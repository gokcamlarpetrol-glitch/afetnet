# AfetNet — EEW & Offline Kriz Onarımı

> **Tetikleyici:** 2026-05-20 Türkiye'de gerçek M5.4 deprem. Uygulama yayında
> (v1.6.2) ama EEW (erken uyarı) çalışmadı — hiçbir kullanıcı uyarı almadı.
> **Yöntem:** Production Cloud Functions logları (kanıt) + 4 elite uzman
> satır-satır inceleme. Tarih: 2026-05-21.

---

## 1. PRODUCTION KANITI (afetnet-4a6b6, deprem günü logları)

| Bulgu | Kanıt |
|---|---|
| Kandilli her polling'de timeout | `eewMonitorFast` her dalgada `Kandilli fetch error: TimeoutError` (`eew.ts:200`, 4sn) |
| 4 kaynak da sıfır | Deprem anı (05:56–05:59) dahil: `AFAD=0, Kandilli=0, USGS=0, EMSC=0` |
| Deprem algılanmadı | M5.4 kaynaklardan alınamadı, 16 saat sonra `age 996min` "stale" atlandı — bildirim hiç gitmedi |
| Monitör 49 sn sürüyor | `eewMonitorFast` her çalışma `49011ms` — dakikalık zamanlanmış fonksiyon üst üste biniyor |
| Crowdsourced P-wave ölü | `onPWaveDetection` 48 saatte sıfır tetiklenme |

---

## 2. KÖK NEDENLER (4 uzman, satır-satır)

### A. Backend EEW (`functions/src/eew.ts`)
- **AFAD URL formatı yanlış** (`eew.ts:156`) — tarih `"2026-05-20 14:30:00"` (boşluklu) gönderiliyordu; AFAD apiv2 ISO 8601 `T`-ayraçlı bekliyor → AFAD sürekli boş döndü.
- **`!response.ok` guard yok** — AFAD/USGS/EMSC HTTP 4xx/5xx alsa bile `response.json()` deneyip sessizce `[]` dönüyordu.
- **5dk pencere dar** (`eew.ts:151`) — AFAD'ın 3-8 dk yayın gecikmesini kaçırıyor.
- **Kandilli** — KOERI akademik sunucusu muhtemelen Cloud Functions IP'lerini blokluyor; 4sn timeout + retry yok + varsayılan User-Agent.
- **USGS feed `4.5_hour`** — Türkiye'deki M4.0–4.5 depremleri tamamen kaçırıyor.

### B. Client EEW (on-device algılama)
- **`isDeviceStill()` bloğu** (`OnDeviceEEWService.ts:~124`) — deprem anında cihaz sarsılır, bu kontrol P-dalgası algılamasını **kalıcı bloke ediyor**.
- **`MIN_MAGNITUDE_FOR_ALERT = 0.15g`** (`OnDeviceEEWService.ts:37`) — 100km'deki M5.4'ün ürettiğinin 7-30 katı eşik.
- **P-WAVE sınıflandırma** (`AdvancedSeismicEngine.ts:~231`, `rectilinearity>0.7`) — mobil cihazda neredeyse hiç geçmiyor, gerçek depremler S-WAVE'e düşüp atılıyor.
- **`eew_broadcasts` listener yok** — `subscribeToEEWBroadcasts()` var ama `init.ts` çağırmıyor; backend→client EEW zinciri kopuk.
- Background heartbeat env'leri (`EXPO_PUBLIC_SEISMIC_BACKGROUND_HEARTBEAT`) set değil.

### C. Offline / Mesh
- **`BatteryOptimizedScanner` ↔ `HighPerformanceBle` kopuk** — pil profil mantığı ölü kod; BLE tam güçte tarıyor.
- iOS `CBPeripheralManager` main queue'da; pending-notification eviction SOS'u silebiliyor.
- `OfflineSyncService` lazy import → online geçişte gecikme.
- *İyi haber:* mesh zinciri (keşif→relay→SOS) temelde sağlam.

### D. Mimari kök kusur
**Polling tabanlı EEW gerçek "erken uyarı" değildir.** AFAD/Kandilli "Son Depremler" listesi bir *katalog* kaynağıdır — sismolog onaylı çözüm deprem bittikten 60-180 sn sonra yayınlanır. Polling zinciri toplam **2-4 dakika** gecikme. Gerçek EEW (JMA, ShakeAlert) P-dalgasını gerçek-zamanlı algılar (saniyeler).

---

## 3. UYGULANAN ONARIMLAR (bu tur)

### Backend EEW kaynak entegrasyonu — TAMAM
- `fetchAFADEvents`: ISO-8601 `T` formatı · `!response.ok` guard · 15dk pencere · 8sn timeout · `User-Agent` · `limit=20&orderby=timedesc`
- `fetchKandilliEvents`: 8sn timeout · tek retry · gerçekçi `User-Agent` · gzip
- `fetchUSGSEvents`/`fetchEMSCEvents`: `!response.ok` guard · koordinat doğrulama · USGS M4.0 alt sınır
- `utils.ts`: `USGS_API` → `2.5_hour` feed
- *functions tsc temiz.*

### Client EEW — TAMAM
- `isDeviceStill` bloğu kaldırıldı (deprem anında kalıcı bloke), `MIN_MAGNITUDE_FOR_ALERT` 0.15g→0.02g, S-WAVE işleme, rectilinearity 0.70→0.60
- `init.ts` `eew_broadcasts` Firestore listener bağlandı — backend→client EEW zinciri artık kopuk değil

### Mesh / Offline — TAMAM
- `BatteryOptimizedScanner` ↔ `HighPerformanceBle` duty-cycle köprüsü; **`MeshPowerManager.initialize()` hiç çağrılmıyordu — `init.ts`'e eklendi**
- iOS `CBPeripheralManager` dedicated queue, SOS-öncelikli paket eviction, `OfflineSyncService` önden-import

### Crowdsourced P-wave zinciri — TAMAM
- **`CrowdsourcedSeismicNetwork` userId kopukluğu** — `ensureUserId()` yalnızca init'te çalışıyor, auth sonradan hazır olunca `userId=''` kalıyordu → `reportDetection` sessiz early-return → `seismic_reports` RTDB'ye hiç yazılmıyordu. **`onPWaveDetection`'ın 48 saat hiç tetiklenmemesinin kök nedeni.** Onarıldı.
- STA/LTA eşik 5.0→3.5, confidence 0.85→0.75, `minAcceleration` 0.08g→0.04g, background heartbeat varsayılan açık

*Tümü doğrulandı: ana tsc + functions tsc temiz, 344 test PASS.*

---

## 4. GERÇEK ERKEN-UYARI YOL HARİTASI

> Polling ne kadar iyileştirilse de "erken uyarı" olmaz — en iyi "hızlı bildirim".
> Gerçek EEW kendi gerçek-zamanlı algılama gerektirir.

### HEMEN (1 hafta) — polling'i güvenilir kıl (hayat kurtarır ama "erken" değil)
1. ✅ AFAD birincil katalog kaynağı; Kandilli HTML scraping ikincil/doğrulama
2. `eewMonitorFast` 49sn → **Cloud Functions v2 + Cloud Scheduler** (4×15sn sleep hack'ini kaldır)
3. ✅ USGS/EMSC eşik + Türkiye bbox
4. **`onPWaveDetection` neden 48h tetiklenmedi — `BackgroundSeismicMonitor` teşhisi** (iOS arka plan kısıtı, STA/LTA kalibrasyonu)
5. Kaynak-sağlık alarmları (her kaynak "N dk 0 olay" → uyarı)
6. **Dürüst UX:** kullanıcıya "erken uyarı" değil "deprem bildirimi" de — yanlış güven hayati risk

### KISA VADE (1 ay) — gerçek-zamanlı algılama omurgası
7. Sürekli-çalışan servis (Cloud Run min-instances=1) — **SeedLink** akışına (TU/TK ağı, ORFEUS/EIDA) kalıcı bağlantı
8. Sunucu-tarafı STA/LTA P-dalgası tetiği — sismolog onayını beklemez
9. **Crowdsourced cihaz ağını canlandır** — `BackgroundSeismicMonitor` güvenilir arka plan; hedef: bir M5'te yüzlerce cihaz tetiği
10. Konsensüs kalibrasyonu — `CONSENSUS_THRESHOLD=3` çok düşük; yoğunluk-bazlı dinamik eşik

### UZUN VADE (3 ay) — dünya standardı ve ötesi
11. AFAD ile resmi entegrasyon görüşmesi (webhook — `eewWebhook` endpoint hazır)
12. ML tabanlı P-dalgası algılama (edge CNN)
13. Gerçek-zamanlı magnitüd/epicenter kestirimi (ShakeAlert tarzı)
14. Lead-time / yanlış-alarm kalite metriği panosu

### Referans EEW sistemleri
Google Android Earthquake Alerts (crowdsourced accelerometer, 2.5M+ cihaz) · USGS ShakeAlert · Japonya JMA · MyShake (Berkeley, STA/LTA + ANN) · Meksika SASMEX.

---

## 5. YAYIN NOTU
Backend EEW kaynak fix'leri **deploy edilince** (`firebase deploy --only functions`) production'da hemen etki eder — bu, en yüksek öncelikli tek adımdır. Client/mesh fix'leri yeni app build (EAS) gerektirir.

---

*EEW Kriz Onarımı · AfetNet · 2026-05-21 · Kaynak: production logları + 4 uzman satır-satır inceleme*
