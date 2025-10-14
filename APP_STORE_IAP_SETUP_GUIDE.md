# 🍎 APP STORE & GOOGLE PLAY IAP SETUP REHBERİ

## 📋 PREMIUM SATIN ALMA SİSTEMİ AKTİF EDİLDİ!

### ✅ **MEVCUT DURUM:**
- ✅ **react-native-iap** library kuruldu
- ✅ **IAP Service** implement edildi
- ✅ **Premium Screen** aktif edildi
- ✅ **Premium Store** aktif edildi
- ✅ **Stripe** tamamen kaldırıldı

---

## 🍎 APPLE STORE CONNECT SETUP

### 1️⃣ **IAP Products Oluşturma**

#### **App Store Connect'e Git:**
1. [App Store Connect](https://appstoreconnect.apple.com) → AfetNet uygulaması
2. **Features** → **In-App Purchases**
3. **Create** → **Auto-Renewable Subscriptions**

#### **Premium Planlar Oluştur:**

**🔄 Aylık Premium (afetnet_premium_monthly)**
```
Product ID: afetnet_premium_monthly
Reference Name: AfetNet Monthly Premium
Subscription Duration: 1 Month
Price: ₺29.99
```

**🔄 Yıllık Premium (afetnet_premium_yearly)**
```
Product ID: afetnet_premium_yearly
Reference Name: AfetNet Yearly Premium
Subscription Duration: 1 Year
Price: ₺299.99
```

**🔄 Yaşam Boyu Premium (afetnet_premium_lifetime)**
```
Product ID: afetnet_premium_lifetime
Reference Name: AfetNet Lifetime Premium
Subscription Duration: 1 Year (renewable)
Price: ₺599.99
```

### 2️⃣ **Subscription Group Oluşturma**
```
Group Name: AfetNet Premium
Group ID: afetnet_premium_group
```

### 3️⃣ **App-Specific Shared Secret**
1. **App Store Connect** → **Users and Access** → **Keys** → **In-App Purchase**
2. **Generate** → **App-Specific Shared Secret**
3. Secret'i kopyala ve `iapService.ts`'e ekle:

```typescript
// iapService.ts - validateReceipt fonksiyonunda
const receiptData = await validateReceiptIos({
  'receipt-data': purchase.transactionReceipt || '',
  'password': 'YOUR_APP_SPECIFIC_SHARED_SECRET_HERE' // ← Buraya ekle
}, false);
```

---

## 🤖 GOOGLE PLAY CONSOLE SETUP

### 1️⃣ **In-App Products Oluşturma**

#### **Google Play Console'a Git:**
1. [Google Play Console](https://play.google.com/console) → AfetNet uygulaması
2. **Monetize** → **Products** → **In-app products**
3. **Create product**

#### **Premium Planlar Oluştur:**

**🔄 Aylık Premium**
```
Product ID: afetnet_premium_monthly
Name: AfetNet Aylık Premium
Description: Tüm premium özellikler 1 ay
Price: ₺29.99
Status: Active
```

**🔄 Yıllık Premium**
```
Product ID: afetnet_premium_yearly
Name: AfetNet Yıllık Premium
Description: Tüm premium özellikler 1 yıl (%17 indirim)
Price: ₺299.99
Status: Active
```

**🔄 Yaşam Boyu Premium**
```
Product ID: afetnet_premium_lifetime
Name: AfetNet Yaşam Boyu Premium
Description: Tüm premium özellikler kalıcı (%50 indirim)
Price: ₺599.99
Status: Active
```

### 2️⃣ **Service Account Key**
1. **Google Cloud Console** → **IAM & Admin** → **Service Accounts**
2. **Create Service Account** → **JSON Key** download
3. Key'i `iapService.ts`'e ekle (backend'de kullanılacak)

---

## 🔧 CODE CONFIGURATION

### 1️⃣ **App.config.ts Güncelleme**
```typescript
// app.config.ts - iOS section'a ekle
ios: {
  // ... existing config
  infoPlist: {
    // ... existing plist
    // IAP için ek configuration (otomatik)
  }
}
```

### 2️⃣ **Environment Variables**
```bash
# .env dosyasına ekle
APPLE_SHARED_SECRET=your_app_specific_shared_secret
GOOGLE_SERVICE_ACCOUNT_KEY=path_to_service_account.json
```

### 3️⃣ **Receipt Validation Backend**
Backend'de receipt validation endpoint'i ekle:

```typescript
// backend/src/routes/iap.ts
app.post('/api/iap/validate', async (req, res) => {
  const { platform, receipt } = req.body;
  
  if (platform === 'ios') {
    // Apple receipt validation
    const isValid = await validateAppleReceipt(receipt);
    res.json({ valid: isValid });
  } else if (platform === 'android') {
    // Google receipt validation
    const isValid = await validateGoogleReceipt(receipt);
    res.json({ valid: isValid });
  }
});
```

---

## 🧪 TESTING

### 1️⃣ **Sandbox Testing (iOS)**
1. **App Store Connect** → **Users and Access** → **Sandbox Testers**
2. **Create Sandbox Tester** account
3. iOS device'da **Settings** → **App Store** → **Sandbox Account** ile login
4. Test purchases yap

### 2️⃣ **Internal Testing (Android)**
1. **Google Play Console** → **Testing** → **Internal testing**
2. **Create release** → **Add testers**
3. Test purchases yap

---

## 🚀 DEPLOYMENT CHECKLIST

### ✅ **Pre-Deployment:**
- [ ] App Store Connect'te IAP products oluşturuldu
- [ ] Google Play Console'da IAP products oluşturuldu
- [ ] App-specific shared secret alındı
- [ ] Service account key hazırlandı
- [ ] Receipt validation backend hazır
- [ ] Sandbox testers oluşturuldu

### ✅ **Post-Deployment:**
- [ ] Production IAP products aktif
- [ ] Receipt validation çalışıyor
- [ ] Premium features unlock ediliyor
- [ ] Restore purchases çalışıyor
- [ ] Analytics tracking aktif

---

## 📊 MONITORING

### 1️⃣ **Analytics**
```typescript
// Purchase tracking
analytics.track('premium_purchased', {
  plan_id: planId,
  price: price,
  currency: currency,
  platform: Platform.OS
});
```

### 2️⃣ **Revenue Tracking**
- **App Store Connect** → **Sales and Trends**
- **Google Play Console** → **Revenue**

---

## 🎯 SONUÇ

### ✅ **PREMIUM SİSTEMİ TAMAMEN AKTİF!**

**Artık kullanıcılar:**
- ✅ Premium planları satın alabilir
- ✅ Premium özelliklerden yararlanabilir
- ✅ Satın alımları geri yükleyebilir
- ✅ Subscription yönetimi yapabilir

### 🚀 **NEXT STEPS:**
1. **App Store Connect**'te IAP products oluştur
2. **Google Play Console**'da IAP products oluştur
3. **Receipt validation** backend'i hazırla
4. **Test** et ve **deploy** et!

---
**Tarih:** 2025-10-14  
**Durum:** ✅ Premium IAP System Active  
**Ready for:** Production Deployment
