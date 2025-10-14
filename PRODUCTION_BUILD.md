# 📦 AfetNet - Production Build Kılavuzu

## ⏱️ Tahmini Süre: 30-45 dakika

---

## ÖN GEREK SİNİMLER

✅ Icon oluşturuldu (1024x1024)  
✅ Splash oluşturuldu (1242x2688)  
✅ `google-services.json` eklendi  
✅ Backend API deploy edildi  
✅ TypeScript hataları yok  

---

## ADIM 1: EAS CLI Kurulumu (5 dk)

### 1.1 EAS CLI Kur
```bash
npm install -g eas-cli
```

### 1.2 Expo Hesabı Oluştur/Giriş
```bash
eas login
```

Henüz hesabın yoksa:
```bash
eas register
# Email, şifre, kullanıcı adı gir
```

---

## ADIM 2: Proje Yapılandırması (5 dk)

### 2.1 EAS Init
```bash
cd /Users/gokhancamci/AfetNet1
eas init
```

**Sorular**:
- `Would you like to link...?` → **Yes**
- `What would you like your slug to be?` → `afetnet`

### 2.2 Build Profili Kontrol
`eas.json` dosyası kontrol et:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "channel": "stable",
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

✅ `autoIncrement`: true olmalı (version otomatik artacak)  
✅ `buildType`: "aab" olmalı (Google Play için)

---

## ADIM 3: Android Production Build (20-30 dk)

### 3.1 Build Başlat
```bash
eas build --platform android --profile production
```

**Sorular**:
- `Generate a new Android Keystore?` → **Yes**  
  (İlk build için yeni keystore oluşturulacak)

### 3.2 Build Süreci
```
✔ Validating project configuration
✔ Uploading project to EAS
✔ Building on EAS servers...
⏳ Build in progress (15-25 dakika)
```

**Not**: Build cloud'da yapılıyor, bilgisayarınızı kapatabilirsiniz!

### 3.3 Build Tamamlandı
```
✅ Build successful!
📦 Download: https://expo.dev/artifacts/eas/...
```

**AAB dosyasını indir**:
```bash
# Otomatik indirilecek veya manuel:
eas build:download --platform android --profile production
```

---

## ADIM 4: iOS Build (Opsiyonel - 30 dk)

**Gereksinimler**:
- Apple Developer hesabı ($99/yıl)
- Mac bilgisayar

```bash
eas build --platform ios --profile production
```

**Sorular**:
- Apple ID gir
- Team seç
- Provisioning profile oluştur

---

## ADIM 5: Build Doğrulama (5 dk)

### 5.1 AAB Bilgilerini Kontrol
```bash
# Build ID'yi kopyala
eas build:list

# Detayları görüntüle
eas build:view BUILD_ID
```

### 5.2 İndir ve Kontrol
```bash
cd ~/Downloads
ls -lh *.aab

# Boyut kontrolü (genellikle 40-100 MB)
du -h *.aab
```

---

## ADIM 6: Test APK (Opsiyonel)

Yayından önce test etmek için APK oluştur:

```bash
eas build --platform android --profile preview
```

APK direkt cihaza install edilebilir!

---

## ADIM 7: Submit (Google Play) - AUTO

### 7.1 Google Play Console Hesabı
```
1. play.google.com/console
2. Developer hesabı oluştur ($25 bir kerelik)
3. Kimlik doğrulama (1-2 gün sürebilir)
```

### 7.2 Auto Submit
```bash
eas submit --platform android --latest
```

**Sorular**:
- Google Play Service Account JSON? → **Create new**  
  (Otomatik oluşturulacak)

**Veya Manuel**:
1. AAB'yi indir
2. Google Play Console → "Create app"
3. Production → "Create release"
4. AAB'yi upload et

---

## 🔍 SORUN GİDERME

### "Build failed: Missing google-services.json"
```bash
# Dosya var mı kontrol et
ls /Users/gokhancamci/AfetNet1/google-services.json

# app.config.ts'te yorumu kaldır
googleServicesFile: "./google-services.json"
```

### "Build failed: TypeScript errors"
```bash
# Type check
npm run typecheck

# Hataları düzelt
```

### "Keystore lost"
```
⚠️  İLK BUILD'den sonra keystore'u yedekle!

# Keystore bilgilerini göster
eas credentials

# credentials.json'u güvenli yere kaydet
```

### "Build timeout"
```
# Tekrar dene
eas build --platform android --profile production

# Veya support ticket aç
eas support
```

---

## 📊 BUILD SONRASI

### Build Başarılı ✅

```
✅ AAB oluşturuldu (~/Downloads/...)
✅ Version code: 1 (otomatik arttı)
✅ Google Play'e hazır
```

### Sonraki Adımlar:

1. **Test**: AAB'yi internal testing'e yükle
2. **Screenshots**: 6-8 ekran görüntüsü çek
3. **Store Listing**: Açıklama, kategori, privacy policy
4. **Production**: Yayınla!

---

## 💡 İPUÇLARI

### Build Hızlandırma
- Cache kullan: `--clear-cache=false`
- Local build (advanced): `eas build --local`

### Version Yönetimi
```json
// app.config.ts
version: "1.0.0"  // Manuel artır veya:

// eas.json
"autoIncrement": true  // Otomatik (önerilen)
```

### Çoklu Build
```bash
# Android + iOS aynı anda
eas build --platform all --profile production
```

---

## 📚 KAYNAKLAR

- EAS Build: https://docs.expo.dev/build/introduction
- Google Play: https://play.google.com/console/developers
- Submit: https://docs.expo.dev/submit/introduction

---

## ✅ SON KONTROL

Build öncesi:

- [ ] `npm run typecheck` → 0 hata
- [ ] `google-services.json` var
- [ ] `app.config.ts` güncel
- [ ] Icon/Splash doğru boyutta
- [ ] EAS hesabı aktif
- [ ] İnternet bağlantısı stabil

Build sonrası:

- [ ] AAB indirildi
- [ ] Boyut makul (< 150 MB)
- [ ] Version code arttı
- [ ] Keystore yedeklendi

---

**Hazırlayan**: AI Assistant  
**Güncelleme**: 7 Ekim 2025






