# AfetNet AI Entegrasyonu - Detaylı Analiz Raporu

## 1. MEVCUT KOD YAPISI ANALİZİ

### 1.1 State Management (Zustand)
Mevcut store'lar:
- `earthquakeStore.ts` - Deprem verileri (items, loading, error, lastUpdate)
- `meshStore.ts` - BLE mesh network state
- `familyStore.ts` - Aile üyeleri
- `healthProfileStore.ts` - Sağlık profili
- `messageStore.ts` - Mesajlar
- `premiumStore.ts` - Premium özellikleri
- `trialStore.ts` - 3 günlük trial
- `userStatusStore.ts` - Kullanıcı durumu
- `settingsStore.ts` - Ayarlar

**Pattern:** Basit Zustand create() kullanımı, persist middleware yok, direct getState/setState

### 1.2 Ana Ekran Komponentleri
**Dosya:** `src/core/screens/home/HomeScreen.tsx`

Mevcut kartlar (sırayla):
1. `HomeHeader` - Başlık ve kullanıcı bilgisi
2. `StatusCard` - Kullanıcı güvenlik durumu
3. `MeshNetworkPanel` - BLE mesh ağ durumu
4. `EarthquakeMonitorCard` - Son depremler (3 deprem gösterimi)
5. `EmergencyButton` - SOS butonu
6. `FeatureGrid` - 6 hızlı erişim kartı (2x3 grid)

**Tasarım özellikleri:**
- Border radius: 20px
- Padding: spacing.lg (16px)
- Renk paleti: Midnight Professional (dark theme)
- Gradient: `['#1a1f2e', '#141824']`
- Border: `colors.border.light` (rgba(255, 255, 255, 0.1))

### 1.3 Renk Paleti
**Dosya:** `src/core/theme/colors.ts`

Ana renkler:
- Background primary: `#0a0e1a`
- Background card: `#141824`
- Accent primary: `#3b82f6` (electric blue)
- Text primary: `#ffffff`
- Text secondary: `#a0aec0`
- Emergency critical: `#ef4444`
- Status success: `#10b981`

### 1.4 Mevcut Servisler
**Dizin:** `src/core/services/`

Kritik servisler:
- `EarthquakeService.ts` - AFAD/USGS/Kandilli deprem verileri (30s polling)
- `BLEMeshService.ts` - Offline P2P iletişim
- `LocationService.ts` - GPS ve background location
- `NotificationService.ts` - Push notifications
- `SOSService.ts` - Acil durum sinyalleri
- `FirebaseService.ts` - Firebase Cloud Messaging
- `FirebaseDataService.ts` - Firestore operations
- `PremiumService.ts` - RevenueCat entegrasyonu

**Init pattern:** `src/core/init.ts` içinde `initWithTimeout()` helper ile tüm servisler başlatılıyor

## 2. AI ENTEGRASYON STRATEJİSİ

### 2.1 Dosya Yapısı Planı
```
src/core/ai/
├── services/
│   ├── OpenAIService.ts          # OpenAI GPT-4 client
│   ├── RiskScoringService.ts     # Kural tabanlı risk skoru
│   ├── PreparednessPlanService.ts # Hazırlık planı (mock → AI)
│   ├── PanicAssistantService.ts  # Afet anı rehberi
│   ├── NewsAggregatorService.ts  # Google News RSS + AFAD
│   └── AIFeatureToggle.ts        # Feature flag (AsyncStorage)
├── stores/
│   ├── aiAssistantStore.ts       # Risk, plan, assistant state
│   └── newsStore.ts              # Haber listesi state
├── types/
│   ├── ai.types.ts               # RiskScore, PreparednessPlan, vb.
│   └── news.types.ts             # NewsArticle, NewsCategory
└── utils/
    ├── aiHelpers.ts              # Yardımcı fonksiyonlar
    └── newsHelpers.ts            # RSS parser helpers
```

### 2.2 Ana Ekran Entegrasyon Stratejisi

**Yeni kartlar (FeatureGrid'den SONRA):**

1. **AIAssistantCard** (~180px yükseklik)
   - Header: "AI Asistan" + BETA badge
   - 3 buton (yan yana):
     - Risk Skorum (mavi gradient)
     - Hazırlık Planı (yeşil gradient)
     - Afet Anı Rehberi (kırmızı gradient)
   - Disclaimer: "Bu içerik bilgilendirme amaçlıdır..."

2. **NewsCard** (~200px yükseklik)
   - Header: "Son Dakika Haberler" + refresh butonu
   - Horizontal scroll: 5 haber kartı (280px genişlik)
   - Her kart: Başlık, kaynak, zaman, magnitude badge (varsa)

**Feature Flag Kontrolü:**
```typescript
{aiFeatureToggle.isFeatureEnabled() && (
  <>
    <AIAssistantCard navigation={navigation} />
    <NewsCard />
  </>
)}
```

### 2.3 Minimum Dokunuş Stratejisi

**DEĞİŞTİRİLMEYECEKLER:**
- Mevcut kartların sırası, boyutu, stili
- Renk paleti ve gradient'ler
- Typography ve spacing değerleri
- Mevcut servisler ve store'lar
- Navigation yapısı (MainTabs)

**EKLENECEKLER:**
- `src/core/ai/` dizini (tamamen izole)
- Ana ekrana 2 yeni kart (en alta)
- `src/core/App.tsx` içine 3 yeni ekran (RiskScore, PreparednessPlan, PanicAssistant)
- `src/core/init.ts` içine AI servisleri (Step 19, en sonda)

## 3. HABER KAYNAKLARI KARŞILAŞTIRMA

### 3.1 Google News RSS (ÖNERİLEN)
**URL:** `https://news.google.com/rss/search?q=deprem+türkiye&hl=tr&gl=TR&ceid=TR:tr`

**Avantajlar:**
- ✅ Ücretsiz
- ✅ API key gerektirmez
- ✅ RSS formatı (basit XML parsing)
- ✅ Türkçe içerik
- ✅ Güncel haberler (dakikalar içinde)

**Dezavantajlar:**
- ❌ Rate limit belirsiz
- ❌ Resmi API değil (RSS feed)

**Parsing stratejisi:**
```typescript
// <item> tag'lerini regex ile bul
const itemRegex = /<item>(.*?)<\/item>/gs;
// <title>, <link>, <pubDate>, <description> extract et
```

### 3.2 AFAD Deprem Verileri (MEVCUT)
**Kaynak:** `EarthquakeService.ts` içinde zaten var

**Avantajlar:**
- ✅ Resmi kaynak
- ✅ Gerçek zamanlı
- ✅ Magnitude ve konum bilgisi

**Kullanım:**
```typescript
// Son 24 saatteki büyük depremleri (>= 4.0) habere dönüştür
convertEarthquakesToNews(): Promise<NewsArticle[]>
```

### 3.3 NewsAPI.org (ALTERNATİF)
**URL:** `https://newsapi.org/v2/everything?q=deprem&language=tr`

**Avantajlar:**
- ✅ Resmi API
- ✅ JSON formatı
- ✅ Detaylı metadata

**Dezavantajlar:**
- ❌ API key gerekli
- ❌ Ücretsiz plan sınırlı (100 req/day)
- ❌ Ticari kullanım için ücretli

**Karar:** Google News RSS + AFAD hibrit yaklaşım (ücretsiz, güvenilir)

## 4. OPENAI ENTEGRASYON PLANI

### 4.1 API Kullanım Senaryoları

**1. Hazırlık Planı Üretme (PreparednessPlanService)**
```typescript
Prompt: "Aile büyüklüğü: 4, Çocuk: Evet, Yaşlı: Hayır
→ Kısa, net, eyleme dönük hazırlık planı oluştur (JSON formatında)"

Model: gpt-4
Max tokens: 500
Temperature: 0.7
```

**2. Risk Analizi (RiskScoringService - İleride)**
```typescript
// Şimdilik kural tabanlı, Phase 4'te AI ile iyileştirilebilir
```

**3. Afet Anı Rehberi (PanicAssistantService - İleride)**
```typescript
// Şimdilik sabit aksiyonlar, Phase 4'te dinamik AI yanıtları
```

### 4.2 Maliyet Tahmini
- GPT-4: ~$0.03 per 1K tokens (input), ~$0.06 per 1K tokens (output)
- Ortalama plan üretme: ~300 tokens input + 400 tokens output = ~$0.03
- Aylık 1000 plan üretimi: ~$30

**Optimizasyon:**
- Planları cache'le (AsyncStorage)
- Fallback: Mock plan (API hatası durumunda)

## 5. FEATURE FLAG STRATEJİSİ

### 5.1 AIFeatureToggle Servisi
```typescript
// AsyncStorage key: 'afetnet_ai_features_enabled'
// Default: İlk kullanımda otomatik aktif
// Ayarlar ekranından kapatılabilir (mesh gibi)
```

### 5.2 Kontrol Noktaları
1. Ana ekran kartları (AIAssistantCard, NewsCard)
2. Init.ts içinde servis başlatma
3. Navigation ekranları (opsiyonel)

## 6. PERFORMANS OPTİMİZASYON

### 6.1 Lazy Loading
- AI servisleri sadece feature flag aktifse yüklensin
- Haberler sadece ana ekran görüntülendiğinde yüklensin
- OpenAI çağrıları sadece gerektiğinde yapılsın

### 6.2 Caching
- Risk skoru: 5 dakika (AsyncStorage)
- Hazırlık planı: Kalıcı (AsyncStorage)
- Haberler: 10 dakika (memory cache)

### 6.3 Memory Management
- Maksimum 20 haber sakla
- Eski AI yanıtlarını temizle
- Store'larda clear() fonksiyonu

## 7. GÜVENLİK VE SORUMLULUK

### 7.1 Disclaimer Metinleri
Tüm AI ekranlarında:
> "Bu içerik bilgilendirme amaçlıdır. AFAD, Kandilli ve resmi kurumların uyarıları her zaman önceliklidir."

### 7.2 API Key Güvenliği
- `.env` dosyasında sakla
- `EXPO_PUBLIC_OPENAI_API_KEY` (Expo convention)
- Git'e commit etme (.gitignore)

### 7.3 Error Handling
- OpenAI API hatası → Mock yanıt döndür
- Haber servisi hatası → Boş liste göster
- Offline mod → Graceful degradation

## 8. SONUÇ VE ÖNERİLER

### 8.1 Uygulama Sırası
1. ✅ PHASE 0: Analiz tamamlandı (bu doküman)
2. ⏭️ PHASE 1: Altyapı (types, mock servisler)
3. ⏭️ PHASE 2: State entegrasyonu (stores, init.ts)
4. ⏭️ PHASE 3: UI entegrasyonu (kartlar, ekranlar)
5. ⏭️ PHASE 4: Gerçek API (OpenAI, News RSS)
6. ⏭️ PHASE 5: Test ve optimizasyon
7. ⏭️ PHASE 6: Final review ve merge

### 8.2 Kritik Başarı Faktörleri
- ✅ Mevcut tasarımı bozmamak
- ✅ Mevcut özellikleri kırmamak
- ✅ TypeScript/lint hatası bırakmamak
- ✅ Feature flag ile kontrol edilebilir olmak
- ✅ Offline modda çalışabilmek (fallback'ler)

### 8.3 Risk Azaltma
- Her phase'de git commit
- Her phase'de TypeScript + lint kontrolü
- Mock implementasyonlarla başla, gerçek API'yi sonra ekle
- Feature flag ile kolayca geri alınabilir

---

**Hazırlayan:** AI Assistant
**Tarih:** 2025-11-04
**Versiyon:** 1.0
**Durum:** ✅ Tamamlandı

