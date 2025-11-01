# KRİTİK ÇÖZÜM - Developer Portal'da Manuel Açma

## 🔴 Sorun
Xcode capability'leri gösteriyor ama provisioning profile oluşturulurken eklenmiyor çünkü **Developer Portal'da App ID'de capability'ler KAPALI**.

## ✅ ÇÖZÜM: Developer Portal'da Manuel Açın

### Adım 1: Developer Portal'a Gidin
https://developer.apple.com/account/resources/identifiers/list

### Adım 2: App ID'yi Düzenleyin
1. `com.gokhancamci.afetnetapp` App ID'yi bulun
2. Üzerine tıklayın → **Edit** butonuna tıklayın

### Adım 3: Bu Capability'leri ENABLE Yapın

**ENABLE sütununda checkbox'ı işaretleyin:**

1. ✅ **Push Notifications** → ENABLE
   - Configure butonuna tıklayın
   - Key oluşturmanız gerekebilir (Xcode otomatik yapabilir)

2. ✅ **Associated Domains** → ENABLE (zaten açık olabilir)

3. ✅ **In-App Purchase** → ENABLE

4. ✅ **Apple Pay Payment Processing** → ENABLE
   - Edit butonuna tıklayın
   - merchant.com.gokhancamci.afetnetapp seçili olmalı

5. ✅ **Location Push Service Extension** → ENABLE

### Adım 4: Background Modes ve Bluetooth LE

**Bu capability'ler listede görünmüyor çünkü:**
- Xcode otomatik yönetiyor
- **AMA** bunları açmak için Xcode'da capability'leri **kaldırıp tekrar eklemelisiniz**

### Adım 5: Save
Developer Portal'da **Save** butonuna tıklayın

---

## 🎯 Xcode'da Son Adımlar

### 1. Capability'leri Kaldırıp Tekrar Ekle (ZORUNLU!)

**Signing & Capabilities** sekmesinde:

1. **Background Modes** → Sağdaki **"-"** butonuna tıklayın → Kaldırın
2. **"+ Capability"** butonuna tıklayın
3. **Background Modes** → Ekle
4. İçinde şunları işaretleyin:
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Uses Bluetooth LE accessories

### 2. Push Notifications
- Eğer **Push Notifications** capability'si varsa → **"-"** ile kaldır → **"+ Capability"** ile tekrar ekle

### 3. Profile İndir
1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID → Team → **"Download Manual Profiles"**

### 4. Try Again
1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın

---

## ⚠️ ÖNEMLİ!

**Developer Portal'da capability'leri açmadan** Xcode'da "Try Again" yaparsanız hata devam eder!

**Önce:** Developer Portal'da capability'leri açın
**Sonra:** Xcode'da capability'leri kaldırıp tekrar ekleyin
**En son:** Try Again yapın

---

## ✅ Beklenen Sonuç

İşlemler tamamlandıktan sonra:
- ✅ "Automatic signing succeeded" mesajı
- ✅ Provisioning Profile capability'leri içeriyor
- ✅ Archive alabilirsiniz

