# 🚨 Hızlı Çözüm - Development Build Crash

## ⚡ Hemen Yapılacaklar

### 1. Terminal'de Expo Dev Server'ı Başlatın

```bash
cd /Users/gokhancamci/AfetNet1
npm run start:dev
```

Bu komut:
- Expo dev server'ı başlatır
- QR kod gösterir
- Tunnel bağlantısı sağlar (internet üzerinden bağlanabilirsiniz)

### 2. Telefonda Development Build'i Başlatın

1. **Telefonda AfetNet uygulamasını açın**
2. **"Enter URL manually" butonuna tıklayın**
3. **Terminal'deki URL'yi girin** (örnek: `exp://192.168.1.100:8081` veya tunnel URL)

### 3. Alternatif: Xcode'dan Crash Log'una Bakın

Eğer hala crash ediyorsa:

1. **Xcode'u açın**
2. **Window > Devices and Simulators**
3. **Telefonunuzu seçin**
4. **"View Device Logs"** butonuna tıklayın
5. **Son crash log'unu bulun** ve hatayı okuyun

## ✅ Yapılan Düzeltmeler

- ✅ App.tsx'teki tüm initialization'lar try-catch ile korundu
- ✅ Hata durumunda uygulama crash etmeden devam ediyor
- ✅ Her servis bağımsız olarak hata yönetiliyor

## 🔍 Sorun Devam Ederse

Crash log'unu paylaşın, tam hatayı görelim.


