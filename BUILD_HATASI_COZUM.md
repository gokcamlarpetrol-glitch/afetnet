# 🔧 BUILD HATASI ÇÖZÜMÜ

**Tarih:** 2024-12-19  
**Build ID:** 76af7b2b-962d-431f-86e8-ea6707a3f1cf  
**Durum:** ❌ Failed - Install dependencies aşamasında başarısız

---

## 🔍 HATA ANALİZİ

### Build Hatası
- **Aşama:** Install dependencies
- **Hata:** "Unknown error. See logs of the Install dependencies build phase for more information."
- **Build Log URL:** https://expo.dev/accounts/gokhancamci1/projects/afetnet/builds/76af7b2b-962d-431f-86e8-ea6707a3f1cf

### Olası Nedenler

1. **Node Version Uyumsuzluğu**
   - `eas.json`'da `node: "20.11.1"` belirtilmiş
   - EAS build ortamında bu versiyon mevcut olmayabilir

2. **Dependencies Sorunları**
   - `package.json`'daki bazı paketler build sırasında yüklenemiyor olabilir
   - Native modüller için ek yapılandırma gerekebilir

3. **Postinstall Script Sorunu**
   - `postinstall` script'i EAS build'de çalışmıyor olabilir
   - `EAS_BUILD` kontrolü var ama yine de sorun çıkarabilir

4. **Memory/Resource Limitleri**
   - Build sırasında memory limiti aşılmış olabilir
   - Büyük `node_modules` klasörü sorun çıkarabilir

---

## ✅ ÇÖZÜM ADIMLARI

### 1. Build Loglarını İnceleme

```bash
# Build loglarını görüntüle
eas build:view 76af7b2b-962d-431f-86e8-ea6707a3f1cf --logs
```

### 2. Node Version Kontrolü

`eas.json` dosyasında Node versiyonunu kontrol edin:

```json
{
  "build": {
    "development": {
      "node": "20.11.1"  // Bu versiyon EAS'ta mevcut mu?
    }
  }
}
```

**Öneri:** Node versiyonunu kaldırın veya daha genel bir versiyon kullanın:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
      // node versiyonunu kaldırın - EAS otomatik seçsin
    }
  }
}
```

### 3. Postinstall Script Düzeltmesi

`package.json`'daki `postinstall` script'ini kontrol edin:

```json
{
  "scripts": {
    "postinstall": "if [ \"$EAS_BUILD\" != \"true\" ]; then echo 'Local postinstall complete'; else echo 'Skipping postinstall on EAS'; fi"
  }
}
```

Bu script zaten EAS build'i kontrol ediyor, ama yine de sorun çıkarabilir. Daha güvenli bir versiyon:

```json
{
  "scripts": {
    "postinstall": "echo 'Postinstall script completed'"
  }
}
```

### 4. .easignore Dosyası Oluşturma

Büyük dosyaları build'e dahil etmemek için `.easignore` oluşturun:

```bash
# .easignore
node_modules/
.git/
.vscode/
*.log
dist/
server/
```

### 5. Dependencies Temizleme

Yerel olarak dependencies'leri temizleyip yeniden yükleyin:

```bash
rm -rf node_modules package-lock.json
npm install
```

### 6. Build Cache Temizleme

EAS build cache'ini temizleyin:

```bash
eas build --platform ios --profile development --clear-cache
```

---

## 🌐 BACKEND DURUMU

### Backend URL
- **Production:** https://afetnet-backend.onrender.com
- **Health Check:** https://afetnet-backend.onrender.com/health

### Backend Kontrolü

```bash
# Backend health check
curl https://afetnet-backend.onrender.com/health

# Backend durumu
curl https://afetnet-backend.onrender.com/
```

### Backend Deploy Durumu

Backend Render.com'da deploy edilmiş görünüyor. Kontrol için:

1. **Render.com Dashboard:** https://dashboard.render.com
2. **Backend Service:** `afetnet-backend`
3. **Deploy Logs:** Render dashboard'dan kontrol edin

### Backend Environment Variables

Backend'in çalışması için gerekli environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `BASE_URL` - Backend URL (deploy sonrası)
- `OPENAI_API_KEY` - OpenAI API key (opsiyonel)
- `ORG_SECRET` - Organization secret

Detaylı bilgi: `server/DEPLOY_ENV_VARIABLES.md`

---

## 🚀 YENİDEN BUILD DENEMESİ

### 1. Önce Yerel Kontroller

```bash
# TypeScript kontrolü
npm run typecheck

# ESLint kontrolü
npm run lint

# Dependencies kontrolü
npm install
```

### 2. Build Komutu (Cache Temizleyerek)

```bash
# iOS Development Build (cache temizleyerek)
eas build --platform ios --profile development --clear-cache

# Veya Node versiyonunu kaldırarak
eas build --platform ios --profile development
```

### 3. Alternatif: Preview Profile Kullanma

```bash
# Preview profile (daha az strict)
eas build --platform ios --profile preview
```

---

## 📋 CHECKLIST

Build öncesi kontrol listesi:

- [ ] `eas.json` Node versiyonu kontrol edildi
- [ ] `package.json` postinstall script kontrol edildi
- [ ] `.easignore` dosyası oluşturuldu (opsiyonel)
- [ ] Yerel dependencies temizlendi (`rm -rf node_modules`)
- [ ] TypeScript hataları yok (`npm run typecheck`)
- [ ] ESLint hataları yok (`npm run lint`)
- [ ] Backend çalışıyor (health check)
- [ ] Environment variables ayarlandı

---

## 🐛 SORUN GİDERME

### Build Hala Başarısız Olursa

1. **Build loglarını detaylı inceleyin:**
   ```bash
   eas build:view [BUILD_ID] --logs
   ```

2. **EAS Support'a başvurun:**
   - Build log URL'ini paylaşın
   - Hata mesajını paylaşın
   - `package.json` ve `eas.json` dosyalarını paylaşın

3. **Alternatif çözümler:**
   - Simulator build yerine device build deneyin
   - Preview profile kullanın
   - Production profile kullanın (daha stabil olabilir)

---

## ✅ SONRAKI ADIMLAR

1. ✅ Build loglarını inceleyin
2. ✅ `eas.json` Node versiyonunu kaldırın veya düzeltin
3. ✅ Yerel dependencies'leri temizleyin
4. ✅ Cache temizleyerek yeniden build deneyin
5. ✅ Backend durumunu kontrol edin
6. ✅ Başarılı build sonrası telefonda test edin

---

**Not:** Build loglarını mutlaka inceleyin - spesifik hata mesajı orada olacaktır!









