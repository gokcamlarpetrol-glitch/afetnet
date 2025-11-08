# 🔐 EAS Secrets Setup Guide

Bu dokümantasyon, AfetNet uygulaması için EAS Build'de kullanılacak environment variable'ların (secrets) nasıl ayarlanacağını açıklar.

## 📋 Gerekli Secrets Listesi

Production build'ler için aşağıdaki secret'ların EAS Secrets olarak ayarlanması gerekmektedir:

### 1. Backend Worker Secret
```bash
eas secret:create --scope project --name ORG_SECRET --value "your-org-secret-value"
```
**Açıklama:** Backend push worker için shared secret header. Backend ile eşleşmeli.

### 2. Firebase Configuration
```bash
eas secret:create --scope project --name FIREBASE_API_KEY --value "your-firebase-api-key"
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "your-firebase-project-id"
```
**Açıklama:** Firebase servisleri için API key ve Project ID.

### 3. OpenAI API Key
```bash
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "your-openai-api-key"
```
**Açıklama:** AI özellikleri için OpenAI API key. `EXPO_PUBLIC_` prefix'i client-side erişim için gereklidir.

### 4. RevenueCat API Keys
```bash
eas secret:create --scope project --name RC_IOS_KEY --value "your-revenuecat-ios-key"
eas secret:create --scope project --name RC_ANDROID_KEY --value "your-revenuecat-android-key"
```
**Açıklama:** Premium özellikler ve IAP için RevenueCat API key'leri.

## 🚀 Setup Adımları

### 1. EAS CLI Kurulumu
```bash
npm install -g eas-cli
eas login
```

### 2. Project'e Bağlanma
```bash
cd /path/to/AfetNet1
eas build:configure
```

### 3. Secrets Oluşturma
Yukarıdaki listedeki tüm secret'ları oluşturun:

```bash
# Backend Worker Secret
eas secret:create --scope project --name ORG_SECRET

# Firebase
eas secret:create --scope project --name FIREBASE_API_KEY
eas secret:create --scope project --name FIREBASE_PROJECT_ID

# OpenAI
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY

# RevenueCat
eas secret:create --scope project --name RC_IOS_KEY
eas secret:create --scope project --name RC_ANDROID_KEY
```

**Not:** `--value` parametresi ile birlikte kullanırsanız, secret değeri komut satırından girilir. Güvenlik için `--value` olmadan kullanmanız önerilir (interactive mode).

### 4. Secrets Kontrolü
Oluşturulan secret'ları kontrol edin:

```bash
eas secret:list
```

### 5. Build Profilleri
`eas.json` dosyasında environment variable'lar zaten tanımlı. EAS Secrets otomatik olarak bu variable'lara inject edilir.

## 🔍 Secret Kullanımı

### app.config.ts
Environment variable'lar `app.config.ts` dosyasında `extra` bölümünde tanımlı:

```typescript
extra: {
  ORG_SECRET: process.env.ORG_SECRET || '',
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
  // vb.
}
```

### Runtime Kullanımı
Uygulama içinde `src/core/config/env.ts` üzerinden erişilir:

```typescript
import { ENV } from '@/core/config/env';

const secret = ENV.ORG_SECRET;
```

## ⚠️ Önemli Notlar

1. **Güvenlik:** Secret değerlerini asla git'e commit etmeyin!
2. **Scope:** `--scope project` kullanın (tüm build profilleri için geçerli)
3. **Environment:** Secret'lar tüm build profilleri (development, preview, production) için geçerlidir
4. **Override:** Profile-specific secret'lar için `--scope build` kullanabilirsiniz

## 🐛 Sorun Giderme

### Secret Bulunamadı Hatası
```bash
# Secret'ların listesini kontrol edin
eas secret:list

# Secret'ı yeniden oluşturun
eas secret:create --scope project --name SECRET_NAME
```

### Build'de Secret Kullanılmıyor
- `eas.json` dosyasında `env` bölümünü kontrol edin
- Secret adının doğru olduğundan emin olun
- Build log'larını kontrol edin

## 📚 Daha Fazla Bilgi

- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)

