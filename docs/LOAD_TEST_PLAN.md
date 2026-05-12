# AfetNet Load Test Plan — Sprint 13

> **Sprint:** 13 — QA + Game Day 1
> **Tarih:** 2026-05-11
> **Hedef:** AfetNet'in 1M+ kullanici simulayonu altinda calismasini dogrulamak. Gercek bir buyuk deprem aninda **kullanici patlamasi** yasanir; sistem ayakta kalmali.

---

## Test Senaryolari

### Senaryo 1 — EEW Bildirim Patlamasi
**Simulator:** k6, Locust, Artillery

**Yuk:** 1M concurrent kullanici → 5sn icinde EEW push notification triger.

**Hedef:**
- FCM/APNs throughput >= 200K push/sn
- Cloud Function latency p95 < 2000ms
- Firestore write throughput hedef 100K/sn (composite key write)

**Komut taslagi (k6):**
```bash
k6 run --vus 100000 --duration 30s scripts/load/eew_burst.js
```

### Senaryo 2 — SOS Concurrent Activations
**Yuk:** 10K kullanici eszamanli SOS gonderiyor (deprem aninda real-world).

**Hedef:**
- SOSChannelRouter Firestore yazimi p95 < 500ms
- BLE mesh broadcast queue overflow yok (>1000 paket queued)
- Push notification delivery <= 3sn

**Test komutu:**
```bash
k6 run --vus 10000 --duration 60s scripts/load/sos_concurrent.js
```

### Senaryo 3 — Family Status Heartbeat
**Yuk:** 500K aile uyesi 5dk'da bir status update yazar.

**Hedef:**
- Firestore writes/sn: 1700/sn (steady)
- Read amplification: her uye 4-5 family member read → 8500 reads/sn
- onSnapshot listeners 500K — Firebase quota check

### Senaryo 4 — Disaster Map Load
**Yuk:** 100K kullanici Disaster Map'te 5km radyusta nokta sorgulayinca.

**Hedef:**
- GeoQuery latency p95 < 800ms
- Composite index hit oran %95+
- CDN cache hit oran %80+ (mapTile)

### Senaryo 5 — Mesh BLE Saturated Network
**Yuk:** 100 cihaz BLE radyo araliginda ayni anda paket gonderiyor.

**Hedef:**
- Hop sayisi < TTL+2 (loop yok)
- Packet drop oran < %20
- Battery drain <= %3/saat

**Bu fiziksel simulator gerekli — gercek BLE.**

## Tool Onerileri

| Tool | Senaryo | Avantaj |
|---|---|---|
| **k6** | API/HTTP yuk | Hizli, scripting JavaScript, cloud + local |
| **Artillery** | WebSocket + HTTP | Kompleks user flows |
| **Locust** | Python destek | Distributed agents |
| **JMeter** | Eski moda, GUI | Buyuk takim icin |

## Cloud Setup

### Google Cloud Performance Testing
- Cloud Build trigger ile gunluk regression test
- Cloud Monitoring + alerting (latency > p95 threshold)

### Firebase Quota Genisletme
- Firestore: default 10K writes/sn → quota artirma talebi
- Cloud Functions: max instances 100 → 1000 (peak)
- FCM: ücretsiz tier yeterli (sayısız mesaj)

## Sonuc Aksiyonu

- p95 latency 2x threshold ASIYORSA: **rollback yeni deployment**
- Error rate %1+ ise: **post-mortem** zorunlu
- Quota %80+ doluysa: kapasite artirma

---

## DR (Disaster Recovery) Backup Plan

### Firestore Backup
```bash
# Manuel snapshot
gcloud firestore export gs://afetnet-backups/$(date +%Y%m%d) --project=afetnet

# Cron schedule (Cloud Scheduler — günlük 03:00 UTC)
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 3 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/afetnet/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email=backup@afetnet.iam.gserviceaccount.com \
  --message-body='{"outputUriPrefix":"gs://afetnet-backups/auto"}'
```

### Storage Backup
```bash
gsutil -m cp -r gs://afetnet.appspot.com gs://afetnet-backups/storage/$(date +%Y%m%d)
```

### Restore Test
- Aylik DR drill — staging projesine restore + smoke test
- RTO (Recovery Time Objective): < 4 saat
- RPO (Recovery Point Objective): < 24 saat veri kaybi tolere edilebilir

### Backup Retention
- Daily: 30 gun
- Weekly: 90 gun
- Monthly: 365 gun
- Yearly: 7 yil (KVKK retention requirement)

---

## Game Day 1 — Kahramanmaras Senaryosu

### Senaryo
- 06 Subat 2023 saat 04:17 simule
- Mw 7.8 deprem Kahramanmaras merkezli
- 50M kullanici (Turkiye iOS+Android base) icinden:
  - 10M kullanici 200km radyus icinde
  - 1M kullanici 50km radyus icinde
  - 100K kullanici epicentre 10km radyus

### Beklenen Trafik
| Akiş | Yuk |
|---|---|
| EEW push burst | 10M push, 30sn icinde |
| SOS broadcasts | 50K-500K (ilk 1 saatte) |
| Firestore writes | 200K/sn peak |
| BLE mesh peer scan | (cihaz tarafi — yuk yok) |
| Disaster Map view | 5M concurrent in first hour |

### Doom Scenarios
1. Cloud Functions cold-start patlamasi → SOS bekliyor
2. Firestore lock contention → write timeout
3. FCM rate limit (Google quota)
4. Backend Cloud Run autoscale yetisemiyor

### Tahmin Edilen Kayiplar (Su an, fix olmadan)
- Crash rate %5 (su an %0.5)
- Push delivery success %75 (su an %99)
- SOS Cloud write basari %85

### Sonrasi
- Game Day rapor ile mevcut quota artirma talepleri
- Cloud Run min instances ayarlama
- FCM batch optimization

---

**Hazirlayan:** AfetNet Elite Team — Sprint 13
**Tarih:** 2026-05-11
