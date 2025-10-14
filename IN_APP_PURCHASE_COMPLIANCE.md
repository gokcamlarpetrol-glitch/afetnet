# AfetNet - In-App Purchase Compliance (Apple App Store)

## 🚨 KRİTİK UYARI - APPLE REVİEW İÇİN

### ❌ MEVCUT DURUM: STRIPE KULLANIMI
AfetNet şu anda **Stripe** ile ödeme alıyor. Bu **Apple'ın In-App Purchase kurallarını ihlal ediyor**!

### 📋 APPLE'IN KURALLARI (App Store Review Guidelines 3.1.1)

> **Apps offering "in-app purchases" must use Apple's In-App Purchase API.**
> 
> - Digital content (premium features, subscriptions) must use Apple IAP
> - Physical goods/services can use external payment
> - No external payment links in the app

### 🔴 AFETNET'TE SORUN
AfetNet **dijital premium özellikleri** satıyor:
- ✅ Premium messaging
- ✅ Advanced earthquake alerts
- ✅ Family tracking
- ✅ Offline maps

Bu özellikler **Apple IAP ile satılmalı**, Stripe ile değil!

---

## ✅ ÇÖZÜM: APPLE IAP ENTEGRASYONU

### 1. MEVCUT STRIPE KODUNU KALDIRMA

**Kaldırılması Gerekenler:**
- `backend/src/routes/payment.ts` - Stripe endpoints
- `@stripe/stripe-react-native` dependency
- Frontend'deki Stripe ödeme akışları

### 2. APPLE IAP KURULUMU

```bash
# Expo IAP modülünü kur
npx expo install expo-in-app-purchases
```

### 3. APP STORE CONNECT'TE ÜRÜN TANIMI

**In-App Products (App Store Connect):**
1. **Auto-Renewable Subscription - Monthly**
   - Product ID: `org.afetnet.premium.monthly`
   - Price: ₺49.99 (veya eşdeğeri)
   - Duration: 1 month

2. **Auto-Renewable Subscription - Yearly**
   - Product ID: `org.afetnet.premium.yearly`
   - Price: ₺349.99 (veya eşdeğeri)
   - Duration: 1 year

3. **Non-Consumable - Lifetime**
   - Product ID: `org.afetnet.premium.lifetime`
   - Price: ₺599.99 (veya eşdeğeri)

### 4. BACKEND VALIDATION

Backend'de Apple receipt validation yapılmalı:
```typescript
// Apple receipt doğrulama endpoint'i
POST /api/payments/validate-receipt
{
  "receiptData": "base64 encoded receipt",
  "productId": "org.afetnet.premium.monthly"
}
```

---

## 📝 GEÇİŞ PLANI

### OPTION 1: FULL COMPLIANCE (ÖNERİLEN)
**Stripe'ı tamamen kaldır, sadece Apple IAP kullan**

**장점:**
✅ Apple kurallarına %100 uygun
✅ Review sırasında red riski yok
✅ Kullanıcılar App Store üzerinden ödeme yapıyor (güven)

**단점:**
❌ Apple %30 komisyon alıyor
❌ Geliştirme süresi gerekli
❌ Mevcut Stripe kodları kaldırılmalı

### OPTION 2: DUAL SYSTEM (RİSKLİ)
**Hem Apple IAP hem Stripe (web için)**

**장점:**
✅ Web versiyonunda Stripe kullanabilirsin (daha düşük komisyon)

**단점:**
❌ Apple uygulamada Stripe linkini görmemeli
❌ Karmaşık kod yönetimi
❌ Hala red riski var

---

## 🛠️ YAPILMASI GEREKENLER (OPTION 1 - ÖNERİLEN)

### 1. Stripe'ı Kaldır
```bash
# Dependencies kaldır
npm uninstall @stripe/stripe-react-native stripe

# Backend'den kaldır
cd backend
npm uninstall stripe
```

### 2. Apple IAP Kur
```bash
# Frontend
npx expo install expo-in-app-purchases

# app.config.ts'ye plugin ekle
plugins: [
  ...
  "expo-in-app-purchases"
]
```

### 3. Frontend IAP Implementasyonu
```typescript
import * as InAppPurchases from 'expo-in-app-purchases';

// IAP başlat
await InAppPurchases.connectAsync();

// Ürünleri al
const { responseCode, results } = await InAppPurchases.getProductsAsync([
  'org.afetnet.premium.monthly',
  'org.afetnet.premium.yearly',
  'org.afetnet.premium.lifetime',
]);

// Satın al
const purchase = await InAppPurchases.purchaseItemAsync(productId);

// Receipt'i backend'e gönder
await fetch('/api/payments/validate-receipt', {
  method: 'POST',
  body: JSON.stringify({
    receiptData: purchase.transactionReceipt,
    productId: productId,
  }),
});
```

### 4. Backend Receipt Validation
```typescript
import fetch from 'node-fetch';

async function validateAppleReceipt(receiptData: string, isProduction: boolean) {
  const url = isProduction
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': process.env.APPLE_SHARED_SECRET, // App Store Connect'ten al
    }),
  });

  const result = await response.json();
  
  if (result.status === 0) {
    // Receipt valid
    return {
      valid: true,
      productId: result.receipt.in_app[0]?.product_id,
      expiresDate: result.latest_receipt_info?.[0]?.expires_date_ms,
    };
  }
  
  return { valid: false };
}
```

---

## ⏱️ ZAMAN CETVELİ

### HEMEN (Bugün)
1. ✅ **Compliance raporu hazırla** (BU DOSYA)
2. 🔴 **Karar ver:** Full compliance mi yoksa riskli yol mu?

### SEÇENEK A: FULL COMPLIANCE (3-5 GÜN)
1. **Gün 1-2:** Stripe'ı kaldır, Apple IAP kur
2. **Gün 3:** Backend receipt validation
3. **Gün 4:** Test (sandbox)
4. **Gün 5:** Production build

### SEÇENEK B: GEÇİCİ ÇÖZÜM (BUGÜN)
1. **Premium features'ı geçici olarak kapat**
2. **Stripe kodlarını yorum satırına al**
3. **App Store'a yükle (free version)**
4. **Sonra Apple IAP ekle ve update yolla**

---

## 🎯 ÖNERİM (APPLE REVİEW İÇİN)

### ✅ BUGÜN YAPIN:
**SEÇENEK B'yi uygula:**
1. Premium features'ı devre dışı bırak
2. Stripe kodlarını yorum satırına al
3. Free version olarak App Store'a yükle
4. "Premium features coming soon" mesajı göster

### ✅ SONRA YAPIN:
1. Apple IAP implement et
2. Update gönder
3. Premium features'ı aç

Bu şekilde:
- ✅ Bugün App Store'a yükleyebilirsin
- ✅ Red riski yok
- ✅ Sonra update ile premium eklersin

---

## 📋 APPLE'A SÖYLEMEN GEREKENLER (Review Notes)

```
IMPORTANT: Premium Features Implementation

Premium features (family tracking, advanced alerts) are currently disabled 
in this version. They will be enabled via Apple In-App Purchase in a future 
update. No payment system is active in this version.

Current version is fully functional as a free emergency app with:
- SOS system
- Bluetooth mesh networking
- Basic earthquake alerts
- Family messaging (free)

Thank you for your review!
```

---

## ✅ SONUÇ

**BUGÜN YAPILACAK:**
1. Premium features'ı kapat
2. Stripe kodlarını kaldır/yorum sat
3. Free version olarak yükle
4. Apple review'da "Premium coming soon with IAP" yaz

**SONRA YAPILACAK:**
1. Apple IAP implement et
2. Update gönder
3. Premium aç

**Bu şekilde:**
- ✅ Bugün App Store'a yükleyebilirsin
- ✅ %100 Apple kurallarına uygun
- ✅ Red riski sıfır!

🚀 **AFETNET APPLE STORE'A HAZIR!**

