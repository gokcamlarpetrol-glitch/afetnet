# 🚀 Hızlı Başlatma Rehberi

## ✅ Doğru Komutlar

### Development Server Başlatma

**Terminal'de çalıştırın:**

```bash
npm run start:dev
```

**VEYA:**

```bash
npx expo start --dev-client --clear
```

## ❌ Yanlış Komutlar

- ❌ `npm run start:d` → **BU KOMUT YOK!**
- ❌ `npm start` → Standart Expo server (development build için yeterli değil)

## 📋 Tüm Mevcut Komutlar

```bash
# Development
npm run start          # Standart Expo server
npm run start:dev      # Development build için (DOĞRU)
npm run start:lan      # Local network üzerinden

# iOS
npm run ios            # iOS simulator'da çalıştır

# Android
npm run android        # Android emulator'da çalıştır

# Build
npm run build:ios      # iOS build
npm run build:android  # Android build

# Test & Quality
npm run lint           # ESLint
npm run typecheck      # TypeScript kontrolü
npm run test           # Jest tests
npm run healthcheck    # Sağlık kontrolü
```

## 🎯 Development Build İçin Adımlar

1. **Terminal'de dev server'ı başlatın:**
   ```bash
   npm run start:dev
   ```

2. **QR kod veya URL ile bağlanın:**
   - Telefonda AfetNet uygulamasını açın
   - QR kodu okutun VEYA
   - "Enter URL manually" butonuna tıklayıp terminal'deki URL'yi girin

3. **Uygulama açılmalı!**

## ⚠️ Not

Development build için **mutlaka** `npm run start:dev` kullanın. Bu komut:
- `--dev-client` flag'i ile development client'ı başlatır
- `--clear` flag'i ile cache'i temizler
- `--host tunnel` ile internet üzerinden bağlantı sağlar


