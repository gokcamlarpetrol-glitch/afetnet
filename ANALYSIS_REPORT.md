# 📊 AfetNet - Derin Analiz Raporu

## 🔍 Faz 1: Derin Analiz - TAMAMLANDI

### 1. Backend Key'ler ve URL'ler

#### RevenueCat
```typescript
RC_IOS_KEY: appl_vsaRFDWlxPWReNAOydDuZCGEPUS (✅ Var)
RC_ANDROID_KEY: appl_vsaRFDWlxPWReNAOydDuZCGEPUS (✅ Var)
Product IDs:
- org.afetapp.premium.monthly
- org.afetapp.premium.yearly
- org.afetapp.premium.lifetime
```

#### Firebase
```typescript
API_KEY: AIzaSyBD23B2SEcxs7b3W0iyEISWhquRSbXtotQ (✅ Var)
PROJECT_ID: afetnet-4a6b6 (✅ Var)
```

#### Backend API
```typescript
API_BASE: https://afetnet-backend.onrender.com (✅ Var)
Endpoints:
- POST /api/sos - SOS gönderimi
- POST /device/register - Cihaz kaydı
- POST /messages/sync - Mesaj senkronizasyonu
- POST /location/update - Konum güncelleme
```

#### EEW (Erken Deprem Uyarısı)
```typescript
WebSocket URLs:
- EEW_WS_TR_PRIMARY: wss://eew.afad.gov.tr/ws (❌ Eklenecek)
- EEW_WS_TR_FALLBACK: wss://eew.kandilli.org/ws (❌ Eklenecek)
- EEW_WS_GLOBAL_PRIMARY: wss://eew.usgs.gov/ws (❌ Eklenecek)
- EEW_PROXY_WS: Server relay (❌ Eklenecek)

Poll URLs:
- AFAD REST API (❌ Eklenecek)
- Kandilli REST API (❌ Eklenecek)
```

#### Map Tiles
```typescript
Tile Template: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
Subdomains: a, b, c
Offline Storage: /tmp/tiles/
```

---

### 2. Eski Tasarım Analizi (HomeSimple.tsx)

#### Renk Paleti
```typescript
Background: #0a0f1f (Koyu mavi-siyah)
Card Background: #1a1f2f (Açık gri-mavi)
SOS Gradient: ['#ff1744', '#d50000'] (Kırmızı gradient)
Earthquake Colors:
- Minor (<4.0): #fbc02d (Sarı)
- Moderate (4.0-5.0): #ff6f00 (Turuncu)
- Strong (>5.0): #d32f2f (Kırmızı)
```

#### UI Components
1. **SOS Button**
   - Büyük, yuvarlak
   - Kırmızı gradient
   - Pulse animation
   - Icon: alert-circle

2. **Earthquake Cards**
   - Gradient background
   - Magnitude badge (renkli)
   - Location text
   - Time text
   - Depth info
   - Tap to details

3. **Stats Cards**
   - 3 kart: Mesaj, Kişi, Deprem
   - Icon + Number + Label
   - Grid layout
   - Background: #1a1f2f

4. **Mesh Status**
   - Online/Offline indicator
   - Peer count
   - Connection quality
   - Badge: CANLI, OFFLINE, AKTİF

5. **Premium Badge**
   - Gold color (#fbbf24)
   - "Premium" text
   - Crown icon

---

### 3. Özellik Envanteri

#### Core Features (Free)
- ✅ **SOS System**
  - Location-based SOS
  - Offline BLE broadcast
  - Backend API integration
  - Emergency contacts
  
- ✅ **Earthquake Monitoring**
  - AFAD provider
  - USGS provider
  - Kandilli provider
  - Real-time notifications
  - Magnitude-based alerts

- ✅ **Offline Mode**
  - BLE mesh networking
  - Peer discovery
  - Message queuing
  - Cache system

#### Premium Features
- ✅ **Offline Map**
  - Tile download
  - Offline storage
  - User location
  - Earthquake markers

- ✅ **Family Tracking**
  - Location sharing
  - Family chat
  - Emergency contacts
  - Proximity alerts

- ✅ **Advanced Messaging**
  - Offline messaging
  - BLE mesh routing
  - Message encryption
  - Message sync

#### Advanced Features (Premium)
- ✅ **Triage System**
  - Yaralı sınıflandırma (kırmızı, sarı, yeşil, siyah)
  - QR code generation
  - Triage list
  - Priority management

- ✅ **SAR Mode**
  - Search patterns
  - Team coordination
  - Location marking
  - Mission management

- ✅ **Hazard Zones**
  - Zone marking
  - Alert system
  - Map overlay
  - Risk assessment

- ✅ **Logistics**
  - Resource request
  - Resource offer
  - Inventory management
  - Supply tracking

#### Utility Features
- ✅ **Settings**
  - Language selection
  - Notification preferences
  - Privacy settings
  - Account management

- ✅ **Diagnostics**
  - System health
  - Network status
  - BLE mesh status
  - Battery status

- ✅ **Health Monitoring**
  - Device health
  - Service health
  - Connection health
  - Performance metrics

---

### 4. Eksik Özellikler (Yeni Core'da Yok)

#### 1. EEW (Erken Deprem Uyarısı) ❌
- WebSocket integration
- Real-time alerts
- Countdown modal
- Native alarm

#### 2. Offline Map UI ❌
- Map tile display
- User location marker
- Earthquake markers
- Family location markers

#### 3. Family Features ❌
- Location sharing UI
- Family chat UI
- Emergency contacts UI
- Proximity alerts

#### 4. Advanced Features UI ❌
- Triage screen
- SAR screen
- Hazard screen
- Logistics screen

#### 5. Detailed Settings ❌
- Language selection
- Notification preferences
- Privacy settings
- Account management

#### 6. Diagnostics UI ❌
- System health display
- Network status display
- BLE mesh visualization
- Performance metrics

---

### 5. Backend Services Durumu

#### Mevcut Services (✅)
- EarthquakeService (AFAD, USGS, Kandilli)
- BLEMeshService (Peer discovery, messaging)
- NotificationService (Push notifications)
- PremiumService (RevenueCat IAP)
- FirebaseService (FCM, push tokens)
- LocationService (Location tracking)

#### Eksik Services (❌)
- EEWService (WebSocket, real-time alerts)
- AnalyticsService (Event tracking)
- DiagnosticsService (System health)
- FamilyService (Location sharing, chat)
- TriageService (Yaralı yönetimi)
- SARService (Arama kurtarma)
- HazardService (Tehlike bölgeleri)
- LogisticsService (Kaynak yönetimi)

---

### 6. Component Envanteri

#### Yeni Core'da Var (✅)
- Card
- Button
- Input
- Badge
- ErrorBoundary

#### Eski Kodda Var, Yeni Core'da Yok (❌)
- EarthquakeCard (Gradient, magnitude color)
- SOSButton (Pulse animation)
- StatsCard (Mesaj, kişi, deprem)
- MeshStatusCard (BLE durumu)
- StatusBadge (CANLI, OFFLINE, AKTİF)
- PremiumBadge (Premium indicator)
- MagnitudeBadge (Deprem büyüklüğü)
- OnlineIndicator (Online/offline dot)
- MeshIndicator (Mesh bağlantı)
- BatteryIndicator (Batarya durumu)

---

### 7. Sonraki Adımlar

#### Faz 2: UI Migration (90 dk)
1. Tüm eksik component'leri oluştur
2. HomeScreen'i eski tasarımla yeniden yaz
3. Diğer screen'leri güncelle
4. Gradient'leri ve animation'ları ekle

#### Faz 3: Backend Entegrasyon (60 dk)
1. EEW service ekle (WebSocket)
2. Analytics service ekle
3. Eksik backend services ekle
4. Tüm key'leri .env'e ekle

#### Faz 4: Özellik Kontrolü (90 dk)
1. Her özelliği tek tek test et
2. Eksik özellikleri ekle
3. Premium gate ekle
4. Offline mode test et

#### Faz 5: Kod Temizliği (45 dk)
1. 100+ eski screen sil
2. Eski store'ları sil
3. Eski services'leri sil
4. Import'ları güncelle

---

## 📊 Özet

### Toplanan Bilgiler
- ✅ 10+ Backend key/URL
- ✅ 50+ UI component pattern
- ✅ 20+ Feature requirement
- ✅ 100+ Screen listesi
- ✅ Complete color palette
- ✅ Animation patterns

### Eksik Olanlar
- ❌ EEW WebSocket URLs (4 adet)
- ❌ 10+ UI component
- ❌ 8+ Backend service
- ❌ 15+ Screen implementation

### Sonraki Faz
**Faz 2: UI Migration** - Tüm eksik component'leri oluştur ve eski tasarımı %100 yeni core'a taşı.

