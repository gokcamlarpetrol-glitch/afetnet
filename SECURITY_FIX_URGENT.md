# 🚨 KRİTİK GÜVENLİK SORUNU DÜZELTİLDİ

## Sorun
Google, GitHub repository'mizde açık API key tespit etti:
- **Firebase API Key**: `AIzaSyBD23B2SEcxs7b3W0iyEISWhquRSbXtotQ`
- **Firebase Project ID**: `afetnet-4a6b6`
- **RevenueCat Keys**: `appl_vsaRFDWlxPWReNAOydDuZCGEPUS`

Bu keyler `src/core/config/env.ts` dosyasında hardcoded olarak yazılmıştı ve public GitHub'a push edilmişti.

## Yapılan Düzeltmeler

### 1. ✅ Hardcoded Keyleri Kaldırdık
- `src/core/config/env.ts` dosyasındaki tüm default key değerleri silindi
- Artık sadece `.env` dosyasından okunuyor

### 2. ✅ .gitignore Güncellendi
```gitignore
# Firebase Config Files (SENSITIVE - Never commit!)
google-services.json
GoogleService-Info.plist
firebase-config.json
```

### 3. ✅ Firebase Config Dosyaları Git'ten Kaldırıldı
```bash
git rm --cached google-services.json GoogleService-Info.plist
```

### 4. ✅ .env.example Güncellendi
Tüm gerekli environment variable'lar eklendi ve açıklandı.

## 🔴 ACİL YAPILMASI GEREKENLER

### 1. Firebase API Key'i Yenile (ZORUNLU!)
Eski key artık public, **MUTLAKA** yenile:

1. Firebase Console'a git: https://console.firebase.google.com/
2. Project Settings > General
3. Web API Key'i **REGENERATE** et
4. Yeni key'i `.env` dosyasına ekle:
   ```
   FIREBASE_API_KEY=YENİ_KEY_BURAYA
   ```

### 2. RevenueCat Key'lerini Kontrol Et
1. RevenueCat Dashboard: https://app.revenuecat.com/
2. API Keys bölümünden key'lerin güvenliğini kontrol et
3. Gerekirse yenile

### 3. Google Cloud Console'da Kısıtlamalar Ekle
1. https://console.cloud.google.com/
2. APIs & Services > Credentials
3. Firebase API Key'e **Application restrictions** ekle:
   - iOS bundle ID: `com.gokhancamci.afetnetapp`
   - Android package: `com.gokhancamci.afetnetapp`
4. **API restrictions** ekle (sadece gerekli API'ler):
   - Firebase Authentication API
   - Cloud Firestore API
   - Firebase Cloud Messaging API
   - Firebase Storage API

### 4. GitHub Repository'yi Temizle
Eski key'leri git history'den tamamen silmek için:

```bash
# BFG Repo-Cleaner kullan (önerilir)
brew install bfg
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Veya git-filter-repo kullan
pip install git-filter-repo
git filter-repo --invert-paths --path google-services.json --path GoogleService-Info.plist
```

**UYARI**: Bu işlem git history'yi değiştirir, force push gerektirir!

### 5. .env Dosyasını Oluştur
```bash
cp .env.example .env
# .env dosyasını düzenle ve gerçek key'leri ekle
```

### 6. EAS Build Secrets'ı Güncelle
```bash
# Firebase
eas secret:create --scope project --name FIREBASE_API_KEY --value "YENİ_KEY"
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "afetnet-4a6b6"

# RevenueCat
eas secret:create --scope project --name RC_IOS_KEY --value "YENİ_KEY"
eas secret:create --scope project --name RC_ANDROID_KEY --value "YENİ_KEY"

# OpenAI
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "YENİ_KEY"
```

## ✅ Güvenlik Kontrol Listesi

- [x] Hardcoded key'ler kaldırıldı
- [x] .gitignore güncellendi
- [x] Firebase config dosyaları git'ten silindi
- [x] .env.example oluşturuldu
- [ ] **Firebase API key yenilendi** (ZORUNLU!)
- [ ] **RevenueCat key'leri kontrol edildi**
- [ ] **Google Cloud Console'da kısıtlamalar eklendi**
- [ ] **Git history temizlendi** (opsiyonel ama önerilir)
- [ ] **EAS secrets güncellendi**
- [ ] **.env dosyası oluşturuldu**

## 📚 Kaynaklar

- [Firebase Security Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
- [Git History Cleaning](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## 🔐 Gelecekte Önlemler

1. **Asla** API key'leri kod içine yazmayın
2. **Her zaman** `.env` dosyası kullanın
3. **Mutlaka** `.env` dosyasını `.gitignore`'a ekleyin
4. **Kesinlikle** production key'lerini development'ta kullanmayın
5. **Düzenli** olarak key rotation yapın
6. **API restrictions** ve **application restrictions** kullanın
7. **Pre-commit hooks** ile hassas data kontrolü yapın

---

**Son Güncelleme**: 5 Kasım 2025
**Durum**: ⚠️ ACİL AKSIYON GEREKLİ - Firebase key yenilenmeli!

