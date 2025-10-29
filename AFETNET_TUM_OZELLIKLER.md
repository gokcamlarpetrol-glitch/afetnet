# 🌍 AFETNET - TÜM ÖZELLİKLER VE GELİŞMELER
## Elite-Level Disaster Management & Communication Platform

**Versiyon:** 1.0.1  
**Build:** 1  
**Status:** Production Ready  

---

## 📱 ANA ÖZELLİKLER (12 Ekran - FREE)

### 1. 🚨 DEPREM ERKEN UYARI SİSTEMİ (FREE)
**Ekran:** HomeScreen / HomeSimple  
**Özellikler:**
- Real-time deprem bildirimleri (EMSC + KOERI)
- 20 saniye önceden uyarı
- Audio siren alerts
- Full-screen critical alerts
- Sarsıntı öncesi geri sayım
- Safety action guidance
- Push notifications (APNs/FCM)
- BLE Mesh relay (offline destek)

**Teknik Detaylar:**
- Server-side multi-source detection
- P/S wave physics calculation
- ETA estimation
- Geospatial targeting
- EarthquakeWarningService integration

---

### 2. 🗺️ OFFLINE HARİTA (PREMIUM)
**Ekran:** MapScreen / MapOffline  
**Özellikler:**
- MBTiles offline tile server
- Local SQLite caching
- Offline peer tracking
- Real-time location sharing
- Heat grid overlay
- Trail tracking (48 saat)
- Self-check pin'leri
- Facilities/pin mapping

**Teknik:**
- MBTiles server implementation
- Tile prefetch system
- Local coordinate system (ENU)
- Battery-optimized rendering

---

### 3. 📡 BLE MESH İLETİŞİM (PREMIUM)
**Ekran:** Messages / ChatScreen  
**Özellikler:**
- Internet olmadan iletişim
- P2P messaging
- Multi-hop routing (8 hops max)
- End-to-end encryption (E2EE)
- Message queuing with retry
- Store-and-forward messaging
- Priority levels (normal/critical/SOS)
- Automatic acknowledgment

**Teknik:**
- BLE Mesh network implementation
- Message relay system
- Contact discovery
- Automatic retry (exponential backoff)
- TTL-based message expiration

---

### 4. 👨‍👩‍👧‍👦 AİLE TAKİP (PREMIUM)
**Ekran:** Family / FamilyMapScreen  
**Özellikler:**
- Real-time family location
- Aile üyeleri ekleme/çıkarma
- Emergency contact management
- QR kod ile hızlı ekleme
- Family proximity alerts
- Offline location sharing
- Last seen timestamps

**Teknik:**
- Secure family management
- QR code pairing
- Location broadcasting
- Encrypted family data

---

### 5. ⚙️ AYARLAR (FREE - Basic)
**Ekran:** SettingsCore  
**Özellikler:**
- Language/region selection
- Notification preferences
- Privacy controls
- Battery optimization
- Background modes
- Premium status
- IAP management
- Logout

---

## 🔥 PREMIUM ÖZELLİKLER (35+ Ekran)

### OFFLINE & İLETİŞİM
6. **Bridge Mode** - Köprü modu (WFD/LoRa/BLE)
7. **Nearby Chat** - Yakındaki kişilerle sohbet
8. **Group Chat** - Grup mesajlaşma
9. **Voice Notes** - Sesli mesajlar
10. **Morse Code** - Mors alfabesi iletişimi
11. **Audio Beacon** - Sesli beacon
12. **Voice Ping** - Sesli ping
13. **Whisper Nav** - Fısıltı navigasyon

### ACİL DURUM & KURTARMA
14. **SOS Screen** - Acil yardım çağrısı
15. **SOS Tools** - Acil durum araçları
16. **Trapped Mode** - Enkaz altı modu
17. **Rubble Mode** - Enkaz kurtarma
18. **Rescue Wizard** - Kurtarma sihirbazı
19. **Self Check** - Kendi durumunu kontrol
20. **Triage Screen** - Tıbbi triyaj
21. **Evidence Collection** - Kanıt toplama
22. **Rescuer Assist** - Kurtarıcı yardım

### LOJİSTİK & PLANLAMA
23. **Logistics** - Lojistik yönetimi (Çadır, Su, Yemek, İlaç, Ekipman)
24. **Facilities** - Tesis yönetimi
25. **Facility Occupancy** - Tesis doluluk
26. **Inventory** - Envanter takibi
27. **Route Planning** - Rota planlama
28. **Route Editor** - Rota düzenleme
29. **Assembly Points** - Toplanma noktaları
30. **Carrier Mode** - Taşıyıcı modu

### HARİTA & NAVİGASYON
31. **Advanced Map Offline** - Gelişmiş offline harita
32. **Turkey Map** - Türkiye genel harita
33. **Team Map** - Ekip haritası
34. **Family Map** - Aile haritası
35. **Convoy Map** - Konvoy haritası
36. **GoTo Target** - Hedefe git
37. **Compass Direction** - Pusula yönü
38. **Haptic Navigation** - Dokunsal navigasyon
39. **Bearing Screen** - Yön açısı

### GRUPLAR & TAKIM
40. **Groups** - Grup yönetimi
41. **Team** - Takım ekranı
42. **Team Board** - Takım tahtası
43. **Team Map** - Takım haritası
44. **People** - Kişiler listesi
45. **Match Screen** - Eşleştirme

### SENARYO MODLAR
46. **SAR Mode** - Search and Rescue
47. **ICE** - In Case of Emergency card
48. **Carrier Mode** - Taşıyıcı modu
49. **Relay Mode** - Röle modu
50. **Gateway Mode** - Geçit modu
51. **Ops Log** - Operasyon kaydı

### TEKNİK & TEŞHİS
52. **Diagnostics** - Sistem teşhisi
53. **Mesh Health** - Mesh sağlık
54. **BLE Mesh Screen** - BLE mesh arayüzü
55. **Power Screen** - Güç yönetimi
56. **Power Profile** - Güç profili
57. **PDR Screen** - Pedestrian Dead Reckoning
58. **PDR Calibrate** - PDR kalibrasyon
59. **PDR Fusion** - PDR fusion
60. **QR Scanner** - QR kod tarayıcı

### VERİ & SENKRONİZASYON
61. **Sync Screen** - Senkronizasyon
62. **Backup** - Yedekleme
63. **Data Packs** - Veri paketleri
64. **Data Pack Share** - Veri paketi paylaş
65. **Data Pack Receive** - Veri paketi al
66. **Tile Prefetch** - Tile ön-yükleme
67. **Tile Pack** - Tile paket
68. **Export Trail** - İz export
69. **Archive** - Arşiv

### GELİŞMİŞ ÖZELLİKLER
70. **Sonar Detection** - Sonar algılama
71. **Ultra Detection** - Ultrasonik algılama
72. **Audio Detection** - Ses algılama
73. **Heat Overlay** - Isı katmanı
74. **Black Box** - Kara kutu
75. **Attest Request** - Doğrulama isteği
76. **Attest Reply** - Doğrulama cevabı
77. **Attest Collect** - Doğrulama toplama

### RAPORLAMA & VERİ
78. **Report Screen** - Rapor ekranı
79. **Auto Report** - Otomatik rapor
80. **Tasks** - Görevler
81. **Bulletin** - Duyuru tahtası
82. **Incident Board** - Olay tahtası
83. **Drawing Editor** - Çizim editörü
84. **Drawing Manager** - Çizim yöneticisi
85. **Cap Form** - Yetenek formu

### RİSK & GÜVENLİK
86. **Hazard Screen** - Tehlike ekranı
87. **Risk Dashboard** - Risk dashboard
88. **Privacy Audit** - Gizlilik denetimi
89. **Security Screen** - Güvenlik
90. **Road Closures** - Yol kapatmaları

### UTİLİTELER
91. **Emergency Card** - Acil durum kartı
92. **EmergencyCard** - Acil durum kartı v2
93. **Translate** - Çeviri
94. **Language Region** - Dil/bölge
95. **Archives** - Arşivler
96. **Training** - Eğitim
97. **Health** - Sağlık
98. **Notifications** - Bildirimler

### QR & SHARİNG
99. **QR Relay** - QR röle
100. **QR Sync** - QR senkronizasyon
101. **Pairing QR** - Eşleştirme QR
102. **ULB Compose** - ULB oluştur
103. **ULB FEC** - ULB FEC
104. **Zip Preview** - ZIP önizleme

---

## 🔧 TEKNİK YETENEKLER

### OFFLINE PRİMİLER
- ✅ BLE Mesh Communication
- ✅ Store-and-Forward Messaging
- ✅ Pedestrian Dead Reckoning (PDR)
- ✅ Local Coordinate System (ENU)
- ✅ Offline Tile Caching
- ✅ SQLite Local Database
- ✅ End-to-End Encryption

### SENK GÖRÜNCE YEDEKLEME
- Emergency Black Box
- Automatic Data Backup
- Multi-hop Message Relay
- Redundant Communication Paths

### BATTERY OPTİMİZATİON
- Background task throttling
- Selective sensor usage
- Intelligent sync scheduling
- Power-aware features

### KRİTİK BİLDİRİMLER
- Earthquake early warning
- Full-screen critical alerts
- Audio siren alerts
- Haptic feedback
- Countdown timer
- Safety action guidance

### KONUM TAKİP
- Real-time tracking
- Background location
- PDR fallback
- Family/Team tracking
- Last known position

---

## 💰 PREMIUM IAP SİSTEMİ

**3 Plan:**
1. Monthly Premium (Aylık)
2. Yearly Premium (Yıllık)
3. Lifetime Premium (Ömür Boyu)

**Server Verification:**
- Apple verifyReceipt API
- PostgreSQL database
- Automatic entitlement updates
- Zustand state management
- Premium gates

---

## 🏗️ MİMARİ

**Frontend:**
- React Native 0.81.5
- Expo SDK 54
- TypeScript
- Zustand (State)
- React Navigation
- ErrorBoundary

**Backend:**
- Node.js + Express
- PostgreSQL database
- Render.com hosting
- Firebase Admin SDK
- APNs notifications

**Services:**
- Earthquake Detection Service
- Earthquake Warning Service
- IAP Verification Service
- Push Notification Service

---

## 📊 TOPLAM ÖZELLİKLER

**Ekranlar:** 120+ ekran
**Services:** 15+ servis
**Modüller:** 50+ modül
**Kod Satırı:** 60,000+ satır

**ÖZET:**
- ✅ Deprem erken uyarı sistemi
- ✅ Offline harita
- ✅ BLE Mesh iletişim
- ✅ Aile takip
- ✅ 35+ premium özellik
- ✅ IAP sistemi
- ✅ Push notifications
- ✅ End-to-end encryption
- ✅ Battery optimization
- ✅ Background processing

---

**🎯 Bu uygulama, dünyadaki en kapsamlı afet yönetim ve iletişim platformlarından biridir.**
