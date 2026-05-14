# AfetNet — Release Checklist (Phase 0 / v1.6.x)

Manuel smoke testleri. `npm run preflight` geçmeden bu checklist'e geçme.

## Automated gates (must be green)

- [ ] `npm run typecheck` → 0 hata
- [ ] `npm run lint` → 0 hata, 0 warning
- [ ] `npm test` → tüm testler yeşil
- [ ] `npm run preflight` → exit 0 (versiyon senkron + flag check)

## Cihaz smoke testleri (iOS — gerçek cihaz)

### Onboarding
- [ ] Yeni hesap oluştur (telefon doğrulama yok değilse her şey atlanmamalı)
- [ ] KVKK & EULA modalleri görünür ve Türkçe karakter doğru
- [ ] Konum izni "While Using" verilebilir
- [ ] Bildirim izni istenir, "Allow"'a basınca kabul edilir

### SOS — manuel
- [ ] Ana ekrandaki acil durum butonu görünür (P0-8: header'ın hemen altında)
- [ ] Butona basınca **5 saniyelik** countdown başlar (P0-4)
- [ ] İptal butonuna basınca countdown durur, modal kapanır
- [ ] Yeniden başlat → countdown bitince SOS aktif olur
- [ ] Active state'de **ÇÖK • KAPAN • TUTUN** + STOP + 112 butonları yukarıda (P0-9)
- [ ] "Yayın detayları" toggle'ı açılır/kapanır, channel statuses gösterir
- [ ] STOP'a basınca SOS iptal olur

### SOS — offline iptal (P0-1)
- [ ] Wi-Fi + Cellular kapat (Airplane mode + Wi-Fi bırak)
- [ ] SOS başlat, aktif olunca STOP'a bas
- [ ] App'i kill et
- [ ] Airplane mode kapat, app'i aç
- [ ] Logger'da "SOS cancel outbox: drained..." görünmeli (Firebase'e flush oldu)

### EEW (deterministik)
- [ ] Settings → EEW açık
- [ ] AFAD/Kandilli test sinyali geldiğinde bildirim gelir
- [ ] AI tahmin (WaveVisualization) bildirim YAYMAZ (P0-3 — sadece advisory)

### Mesaj — online
- [ ] Eşinizin telefonu ile DM açın, mesaj atın
- [ ] "Bekliyor → Gönderiliyor → Gönderildi" tick'leri sırayla görünür (P0-11)
- [ ] Karşı taraf okuyunca mavi tick

### Mesaj — offline
- [ ] Airplane mode aç
- [ ] DM mesaj at → "Bekliyor" (cloud-offline icon) görünmeli (P0-11)
- [ ] Airplane mode kapat → "Gönderiliyor → Gönderildi" geçişi olur

### AI Asistan
- [ ] PanicAssistant'a gir, AI disclaimer banner görünür (P0-7 — sarı çerçeve, "112'yi arayın" yazıyor)
- [ ] PreparednessPlan'a gir, aynı disclaimer var
- [ ] M6.5+ deprem geldiğinde tsunami warning İSTANBUL kullanıcısına gelmez (P0-14, kıyı bbox check)

### Health Sharing (P0-2)
- [ ] Health profili tanımla, sharing'i aç
- [ ] SOS başlat → yakındaki yabancı device'a HEALTH_SOS gitmez (gate fail-closed)
- [ ] Onaylı aile üyesi: gider ✓
- [ ] Aile üyesi "Geliyorum" ACK gönderir → sonraki broadcast'te o device da alır

### Settings
- [ ] "Sesli Komutlar" toggle'ı UI'dan kalkmış (P0-5)
- [ ] AI Asistan Veri Kullanımı dialog'unda Türkçe karakter doğru (Kullanımı, Hayır, etc.)
- [ ] EULA modal'da Türkçe karakter doğru

## Cihaz smoke testleri (Android — gerçek cihaz)

Aynı senaryolar Android cihazda tekrarlanır. Özellikle:
- [ ] BLE mesh peer discovery (2 cihaz arasında)
- [ ] Heads-up notification SOS için tam ekran açılır

## Backend (Cloud Functions + Firestore)

- [ ] `firebase deploy --only firestore:rules,storage:rules` başarılı
- [ ] sos_broadcasts rule'unda lat/lng artık zorunlu (P0-10 #3)
- [ ] storage.rules chat/voice metadata.recipientUids gerekli (P0-10 #1)
- [ ] Cloud Functions log'da hata yok son 1 saatte

## App Store submit

- [ ] Privacy Policy URL güncel (KVKK + GDPR + AI/sağlık disclaimer)
- [ ] Screenshot setinde "Sesli Komutlar" görünmüyor (P0-5)
- [ ] Description metninde "voice command" claim'i yok
- [ ] Critical Alerts capability requested form gönderilmiş (Apple Developer)
- [ ] What's New (1.6.2): hangi P0 fix'lerin kapsanı

## Tag + commit

- [ ] `git tag v1.6.2`
- [ ] `git push origin main --tags`
- [ ] EAS build başlat: `npm run ios:release`
- [ ] TestFlight upload otomatik olur (eas submit -p ios)
- [ ] Cihaza yeni binary indir, smoke checklist'i baştan çalıştır

---

**Yedi madde yeşil değilse "submit" yok.**
