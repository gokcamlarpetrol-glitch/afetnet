# Apple Developer Portal - Capability Checklist

## ✅ Açılması Gereken Capability'ler

Aşağıdaki capability'leri **Developer Portal'da işaretleyin** (ENABLE sütununda checkbox'ı işaretleyin):

### 1. Push Notifications ✅
- ✅ **"Push Notifications"** → **ENABLE** işaretle
- **Configure** butonuna tıklayın
- **Certificates (0)** görünüyorsa APN Key oluşturmanız gerekebilir (opsiyonel, Xcode otomatik oluşturabilir)

### 2. Associated Domains ✅
- ✅ **"Associated Domains"** → **ENABLE** işaretle
- Zaten açık görünüyor (Xcode'da applinks:afetnet.app var)

### 3. In-App Purchase ✅
- ✅ **"In-App Purchase"** → **ENABLE** işaretle

### 4. Apple Pay Payment Processing ✅
- ✅ **"Apple Pay Payment Processing"** → **ENABLE** işaretle
- **Edit** butonuna tıklayın
- **Enabled Merchant IDs (1)** görünmeli (merchant.com.gokhancamci.afetnetapp)

### 5. Location Push Service Extension ✅
- ✅ **"Location Push Service Extension"** → **ENABLE** işaretle
- Bu, com.apple.developer.location.push için gerekli

### 6. Background Modes (Bulunmuyor ama...)
Listede "Background Modes" görünmüyor, ancak:
- Xcode'da "Background Modes" capability'si eklediğinizde otomatik olarak App ID'ye eklenir
- Veya şu capability'ler içinde olabilir:
  - **"Time Sensitive Notifications"** → ENABLE (background notification'lar için)

### 7. Bluetooth LE (Bulunmuyor ama...)
Listede "Bluetooth LE" görünmüyor. Bu durumda:
- Xcode'da "+ Capability" → "Bluetooth LE" ekleyin
- Xcode otomatik olarak Developer Portal'da App ID'ye ekleyecek

### 8. Location Services (Tam ismi bulunmuyor ama...)
Listede sadece "Location Push Service Extension" var. Ancak:
- **"Maps"** → ENABLE (location kullanımı için gerekebilir)
- Xcode'da "+ Capability" → "Location Updates" ekleyin

---

## 🎯 Öncelik Sırası

1. **Push Notifications** → ENABLE + Configure
2. **Associated Domains** → ENABLE (zaten açık olabilir)
3. **In-App Purchase** → ENABLE
4. **Apple Pay Payment Processing** → ENABLE + Edit (merchant ID kontrolü)
5. **Location Push Service Extension** → ENABLE
6. **Time Sensitive Notifications** → ENABLE (background için)
7. **Maps** → ENABLE (location için)

---

## ⚠️ Xcode'da Yapılacaklar

Developer Portal'da yukarıdakileri açtıktan sonra:

1. Xcode'da **"+ Capability"** butonuna tıklayın
2. Şunları ekleyin:
   - **Background Modes** → içinde:
     - Remote notifications ✅
     - Background fetch ✅
     - Background processing ✅
     - Location updates ✅
   - **Bluetooth LE** → ekleyin
   - **Location Updates** → ekleyin

3. Xcode otomatik olarak Developer Portal'da bunları ekleyecek/aktif edecek

---

## ✅ Save ve Kontrol

1. Developer Portal'da tüm capability'leri ENABLE yaptıktan sonra
2. **Save** butonuna tıklayın
3. Xcode'u kapatıp açın
4. **Signing & Capabilities** → **"Try Again"**

