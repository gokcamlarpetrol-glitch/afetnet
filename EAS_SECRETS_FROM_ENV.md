# 🔐 .env DOSYASINDAN EAS SECRETS OLUŞTURMA REHBERİ

## ✅ DURUM

`.env` dosyası mevcut ve **6 secret değişkeni** de tanımlı!

---

## 📋 MEVCUT SECRETS (.env'de)

| # | Secret Adı | Durum | Değer |
|---|-----------|-------|-------|
| 1 | `EXPO_PUBLIC_OPENAI_API_KEY` | ✅ Mevcut | Değer var |
| 2 | `RC_IOS_KEY` | ✅ Mevcut | Değer var |
| 3 | `RC_ANDROID_KEY` | ⚠️ Placeholder | `goog_your-android-key-here` (güncellenmeli) |
| 4 | `FIREBASE_API_KEY` | ✅ Mevcut | Değer var |
| 5 | `FIREBASE_PROJECT_ID` | ✅ Mevcut | Değer var |
| 6 | `ORG_SECRET` | ✅ Mevcut | Değer var |

---

## 🚀 EAS SECRETS OLUŞTURMA

### Yöntem 1: Otomatik Script (Önerilen)

```bash
# Script'i çalıştır (komutları gösterir)
bash create_eas_secrets_from_env.sh

# Veya direkt olarak komutları çalıştır
bash create_eas_secrets_from_env.sh | grep 'Komut:' | cut -d: -f2- | bash
```

### Yöntem 2: Manuel Komutlar

`.env` dosyasındaki değerleri kullanarak:

```bash
# .env dosyasını yükle
source .env

# 1. OpenAI API Key
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "$EXPO_PUBLIC_OPENAI_API_KEY"

# 2. RevenueCat iOS Key
eas secret:create --scope project --name RC_IOS_KEY --value "$RC_IOS_KEY"

# 3. RevenueCat Android Key (⚠️ Önce .env'de güncelle!)
eas secret:create --scope project --name RC_ANDROID_KEY --value "$RC_ANDROID_KEY"

# 4. Firebase API Key
eas secret:create --scope project --name FIREBASE_API_KEY --value "$FIREBASE_API_KEY"

# 5. Firebase Project ID
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "$FIREBASE_PROJECT_ID"

# 6. Backend Secret
eas secret:create --scope project --name ORG_SECRET --value "$ORG_SECRET"
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **RC_ANDROID_KEY**: `.env` dosyasında placeholder değer var (`goog_your-android-key-here`)
   - RevenueCat Dashboard'dan gerçek Android API Key'i alın
   - `.env` dosyasını güncelleyin
   - Sonra EAS Secret oluşturun

2. **Güvenlik**: `.env` dosyası `.gitignore`'da olduğu için GitHub'a yüklenmeyecek ✅

3. **Build**: Secrets oluşturulduktan sonra build yapın:
   ```bash
   eas build --platform ios --profile production
   ```

---

## ✅ SECRETS KONTROLÜ

Secrets'ları kontrol etmek için:

```bash
eas env:list --scope project
```

---

## 📝 SONRAKI ADIMLAR

1. ✅ `.env` dosyası mevcut ve 5/6 secret hazır
2. ⚠️ `RC_ANDROID_KEY` değerini güncelle
3. 🚀 EAS Secrets oluştur (script veya manuel)
4. ✅ Build yap: `eas build --platform ios --profile production`











