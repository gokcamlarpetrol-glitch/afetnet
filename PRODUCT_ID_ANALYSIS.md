# Product ID Analizi - AfetNet

## Durum Özeti

Kodda ve konfigürasyon dosyalarında **3 farklı Product ID formatı** tespit edildi:

1. **org.afetapp.premium.*** (Ana kod tabanı - TypeScript/JavaScript)
2. **org.afetnet1.premium.*** (StoreKit config - Xcode test için)
3. **org.afetapp.premium.*** (Prompt'ta belirtilen - henüz kullanılmıyor)

---

## Detaylı Liste

### 1. org.afetnetapp.premium.* (Ana Kod)
**Kullanıldığı yerler:**
- `src/lib/revenuecat.ts` - RevenueCat SDK Product ID'leri
- `server/src/products.ts` - Backend product mapping
- `shared/iap/products.ts` - Shared IAP constants
- `scripts/verify-iap-system.js` - IAP doğrulama scripti
- `server/src/migrations/001_create_iap_tables.sql` - Database constraint

**Product ID'ler:**
- `org.afetapp.premium.monthly`
- `org.afetapp.premium.yearly`
- `org.afetapp.premium.lifetime`

**Durum:** ✅ **ANA PRODUCTION KOD TABANI**

---

### 2. org.afetnet1.premium.* (StoreKit Test Config)
**Kullanıldığı yerler:**
- `AfetNet.storekit` - Xcode StoreKit Configuration File
- `AfetNet1.storekit` - Xcode StoreKit Configuration File
- `shared/iap/products-new.*` - "products-new" dosyaları

**Product ID'ler:**
- `org.afetnet1.premium.lifetime` (StoreKit'te sadece lifetime var)

**Durum:** ⚠️ **SADECE XCODE STOREKIT TEST İÇİN** (Simulator'de test için)

---

### 3. org.afetapp.premium.* (Prompt'ta belirtilen)
**Kullanıldığı yerler:**
- ❌ **HİÇBİR YERDE KULLANILMIYOR**

**Durum:** ❌ **HENÜZ KULLANILMADI**

---

## Bundle ID vs Product ID

**Bundle ID (Xcode projesinde):**
- `com.gokhancamci.afetnetapp` ✅ (Doğru ve tutarlı)

**Product ID'ler (IAP için):**
- Kodda: `org.afetnetapp.premium.*` ✅
- StoreKit test: `org.afetnet1.premium.*` (sadece test)
- Prompt'ta: `org.afetapp.premium.*` (kullanılmıyor)

---

## ÖNERİ

### App Store Connect'te Kontrol Edilmesi Gerekenler:

1. **App Store Connect → AfetNet → In-App Purchases**
   - Hangi Product ID'ler oluşturulmuş?
   - `org.afetnetapp.premium.monthly` ✅ (kodda kullanılan)
   - `org.afetnetapp.premium.yearly` ✅ (kodda kullanılan)
   - `org.afetnetapp.premium.lifetime` ✅ (kodda kullanılan)

2. **RevenueCat Dashboard**
   - Products → iOS Products
   - Hangi Product ID'ler eşleştirilmiş?
   - Kodda `org.afetnetapp.premium.*` kullanıldığı için RevenueCat'te de bunlar olmalı.

3. **Karar:**
   - Eğer App Store Connect'te `org.afetapp.premium.*` oluşturulmuşsa:
     - **SEÇENEK A:** Kodda Product ID'leri `org.afetapp.premium.*` olarak değiştir
     - **SEÇENEK B:** App Store Connect'te yeni Product ID'ler oluştur (`org.afetnetapp.premium.*`)
   
   - Eğer App Store Connect'te `org.afetnetapp.premium.*` varsa:
     - ✅ **MEVCUT KOD DOĞRU** - Hiçbir şey yapmaya gerek yok

---

## Şu Anki Durum

**ANA PRODUCTION KODDA:**
```typescript
// src/lib/revenuecat.ts
export const PRODUCT_IDS = {
  MONTHLY: 'org.afetnetapp.premium.monthly',
  YEARLY: 'org.afetnetapp.premium.yearly',
  LIFETIME: 'org.afetnetapp.premium.lifetime',
}
```

**XCODE BUNDLE ID:**
```
com.gokhancamci.afetnetapp
```

**STOREKIT TEST (sadece simulator):**
```
org.afetnet1.premium.lifetime
```

---

## Sonuç

✅ **Kod tutarlı** - Ana kod tabanında `org.afetapp.premium.*` kullanılıyor

⚠️ **App Store Connect kontrolü gerekli** - Hangi Product ID'lerin gerçekten App Store Connect'te oluşturulduğunu kontrol edin.

🔍 **RevenueCat eşleşmesi** - RevenueCat Dashboard'da Product ID'lerin `org.afetnetapp.premium.*` formatında eşleştirildiğinden emin olun.

