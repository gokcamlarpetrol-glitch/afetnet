# 🔐 EAS SECRETS KURULUM REHBERİ

## 📋 GEREKLİ SECRETS LİSTESİ

Projede kullanılan ve **EAS Secrets** olarak oluşturulması gereken environment variable'lar:

### ✅ ZORUNLU SECRETS (6 adet)

1. **EXPO_PUBLIC_OPENAI_API_KEY**
   - Kullanım: OpenAI GPT-4 API için
   - Dosya: `src/core/ai/services/OpenAIService.ts`
   - Nasıl Bulunur: OpenAI Dashboard → API Keys

2. **RC_IOS_KEY**
   - Kullanım: RevenueCat iOS API Key
   - Dosya: `src/lib/revenuecat.ts`, `src/core/services/PremiumService.ts`
   - Nasıl Bulunur: RevenueCat Dashboard → API Keys → iOS

3. **RC_ANDROID_KEY**
   - Kullanım: RevenueCat Android API Key
   - Dosya: `src/lib/revenuecat.ts`, `src/core/services/PremiumService.ts`
   - Nasıl Bulunur: RevenueCat Dashboard → API Keys → Android

4. **FIREBASE_API_KEY**
   - Kullanım: Firebase Web API Key
   - Dosya: `src/core/config/firebase.ts`
   - Nasıl Bulunur: Firebase Console → Project Settings → General → Web API Key

5. **FIREBASE_PROJECT_ID**
   - Kullanım: Firebase Project ID
   - Dosya: `src/core/config/firebase.ts`
   - Nasıl Bulunur: Firebase Console → Project Settings → General → Project ID

6. **ORG_SECRET**
   - Kullanım: Backend API HMAC Secret
   - Dosya: `src/lib/http.ts`, `src/core/api/client.ts`
   - Nasıl Bulunur: Backend yöneticisinden alınmalı

---

## 🚀 SECRETS OLUŞTURMA KOMUTLARI

Aşağıdaki komutları sırayla çalıştırın. Her komutta `YOUR_VALUE` yerine gerçek değeri yazın:

```bash
# 1. OpenAI API Key
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value YOUR_VALUE

# 2. RevenueCat iOS Key
eas secret:create --scope project --name RC_IOS_KEY --value YOUR_VALUE

# 3. RevenueCat Android Key
eas secret:create --scope project --name RC_ANDROID_KEY --value YOUR_VALUE

# 4. Firebase API Key
eas secret:create --scope project --name FIREBASE_API_KEY --value YOUR_VALUE

# 5. Firebase Project ID
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value YOUR_VALUE

# 6. Backend Secret
eas secret:create --scope project --name ORG_SECRET --value YOUR_VALUE
```

---

## 📝 OPSİYONEL SECRETS (Default değerleri var, gerekirse değiştirilebilir)

7. **API_BASE_URL** (default: `https://afetnet-backend.onrender.com`)
   - Kullanım: Backend API base URL
   - Dosya: `src/core/config/env.ts`

8. **EEW_ENABLED** (default: `false`)
   - Kullanım: Early Earthquake Warning özelliği
   - Dosya: `src/core/config/env.ts`

9. **EEW_NATIVE_ALARM** (default: `false`)
   - Kullanım: Native alarm özelliği
   - Dosya: `src/core/config/env.ts`

---

## ✅ SECRETS KONTROLÜ

Secrets'ları kontrol etmek için:

```bash
eas env:list --scope project
```

---

## 🔍 PROJEDE KULLANIM YERLERİ

### EXPO_PUBLIC_OPENAI_API_KEY
- `src/core/ai/services/OpenAIService.ts` - OpenAI API çağrıları
- `src/core/config/env.ts` - Environment config

### RC_IOS_KEY / RC_ANDROID_KEY
- `src/lib/revenuecat.ts` - RevenueCat initialization
- `src/core/services/PremiumService.ts` - Premium service
- `src/core/config/env.ts` - Environment config

### FIREBASE_API_KEY / FIREBASE_PROJECT_ID
- `src/core/config/firebase.ts` - Firebase configuration
- `src/core/services/FirebaseService.ts` - Firebase service
- `src/core/config/env.ts` - Environment config

### ORG_SECRET
- `src/lib/http.ts` - HMAC signature generation
- `src/core/api/client.ts` - API client
- `src/core/config/env.ts` - Environment config

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Güvenlik**: Secrets'lar asla kod deposuna commit edilmemeli
2. **Build**: Secrets'lar build sırasında otomatik olarak inject edilir
3. **Environment**: Her environment (development, preview, production) için ayrı secrets oluşturulabilir
4. **Scope**: `--scope project` kullanarak proje seviyesinde secrets oluşturulur

---

## 🎯 SONRAKI ADIMLAR

1. Yukarıdaki 6 zorunlu secret'ı oluşturun
2. `eas build --platform ios --profile production` komutu ile build yapın
3. Build başarılı olmalı! ✅
