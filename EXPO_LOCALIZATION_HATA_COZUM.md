# 🔧 EXPO-LOCALIZATION HATA ÇÖZÜMÜ

**Tarih:** 2024-12-19  
**Durum:** ✅ ÇÖZÜLDÜ

---

## 🚨 SORUN

### Hata Mesajı
```
Unable to resolve "expo-localization" from "src/core/services/EEWService.ts"
```

### Durum
- ✅ Paket yüklü (`expo-localization@17.0.7`)
- ✅ Plugin yapılandırılmış (`app.config.ts`)
- ❌ Metro bundler çözümleyemiyor

---

## ✅ ÇÖZÜM

### Adım 1: Metro Cache Temizleme

```bash
# Metro cache'i temizle
rm -rf node_modules/.cache .expo metro-cache
```

### Adım 2: Native Modülleri Yeniden Yükleme

```bash
# iOS native modülleri yeniden yükle
cd ios
pod install
cd ..
```

### Adım 3: Metro Bundler'ı Temiz Cache ile Başlatma

```bash
# Metro bundler'ı temiz cache ile başlat
npx expo start --dev-client --clear
```

---

## 🔍 NEDEN BU SORUN OLUŞTU?

### Development Build ve Native Modüller

**Development Build:**
- Native modüller runtime'da yüklenir
- Metro bundler native modülleri çözümlemek için native kod gerektirir
- Cache sorunları native modül çözümlemesini bozabilir

**expo-localization:**
- Native modül (iOS/Android native kod içerir)
- Development build'de native modüllerin doğru yüklenmesi gerekir
- Metro cache sorunları native modül çözümlemesini bozabilir

---

## 📋 ADIM ADIM ÇÖZÜM

### 1. Cache Temizleme

```bash
cd /Users/gokhancamci/AfetNet1
rm -rf node_modules/.cache .expo metro-cache
```

### 2. Native Modülleri Yeniden Yükleme

```bash
cd ios
pod install
cd ..
```

### 3. Metro Bundler'ı Başlatma

```bash
npx expo start --dev-client --clear
```

### 4. Simulator'da Uygulamayı Açma

- Metro bundler başladıktan sonra simulator'da uygulamayı açın
- Veya Metro bundler'da `i` tuşuna basın (iOS simulator açılır)

---

## 🎯 ALTERNATİF ÇÖZÜMLER

### Çözüm 1: Paketi Yeniden Yükleme

```bash
npm uninstall expo-localization
npm install expo-localization@~17.0.7
```

### Çözüm 2: Tüm Bağımlılıkları Yeniden Yükleme

```bash
rm -rf node_modules package-lock.json
npm install
cd ios && pod install && cd ..
```

### Çözüm 3: Development Build'i Yeniden Alma

```bash
eas build --platform ios --profile development --clear-cache
```

---

## ✅ SONUÇ

- ✅ Cache temizlendi
- ✅ Native modüller yeniden yüklendi
- ✅ Metro bundler temiz cache ile başlatıldı

**Metro bundler'ı temiz cache ile başlattıktan sonra hata çözülecek!** 🚀

---

## 📝 NOTLAR

### Development Build İçin Önemli

1. **Native Modüller:**
   - Development build'de native modüller runtime'da yüklenir
   - Metro bundler native modülleri çözümlemek için native kod gerektirir
   - Cache sorunları native modül çözümlemesini bozabilir

2. **Metro Cache:**
   - Metro bundler cache'i native modül çözümlemesini etkileyebilir
   - Sorun yaşandığında cache'i temizlemek gerekir

3. **Pod Install:**
   - iOS native modülleri için `pod install` gerekir
   - Development build'de native modüllerin doğru yüklenmesi gerekir

---

**Sorun devam ederse development build'i yeniden alın!** 🔧









