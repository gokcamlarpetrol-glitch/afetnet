# Xcode Signing Sorunu Açıklaması

## 🔴 Durum

Xcode'da capability'ler **açık** ✅:
- Background Modes (fetch, processing, location, remote notifications)
- Bluetooth LE
- Location Updates
- Push Notifications
- Associated Domains
- Apple Pay

**AMA** hala signing hatası var çünkü:
- Developer Portal'da App ID'de bu capability'ler **aktif değil**
- Bu yüzden Xcode provisioning profile oluşturamıyor

## 💡 Çözüm

Xcode capability'leri **Developer Portal'a otomatik aktarmıyor**!
İki yer var:
1. **Xcode (local)** → Capability'leri gösterir, kodu ayarlar
2. **Developer Portal (online)** → App ID'de capability'ler aktif olmalı

## ✅ Yapılacaklar

### Adım 1: Developer Portal'da Kontrol

Developer Portal'da App ID edit sayfasında şunları **ENABLE** yapın:

1. **Push Notifications** → ENABLE
2. **Associated Domains** → ENABLE
3. **In-App Purchase** → ENABLE
4. **Apple Pay Payment Processing** → ENABLE
5. **Location Push Service Extension** → ENABLE (location.push için)

**Not:** Background Modes, Bluetooth LE capability'leri listede görünmeyebilir çünkü bunlar Xcode tarafından otomatik yönetilir, ama diğerleri manuel açılmalı.

### Adım 2: Xcode'da Manual Profile İndir

1. Xcode → **Preferences** → **Accounts**
2. Apple ID'nizi seçin
3. Team'i seçin
4. **"Download Manual Profiles"** butonuna tıklayın
5. Profiller indirilecek

### Adım 3: Xcode'da Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. Xcode yeni profile'ı kullanacak

### Adım 4: Hala Olmazsa

Eğer hala hata varsa, Xcode'da capability'leri **tekrar ekleyin**:

1. **Background Modes** capability'sini **kaldırın** ("-" butonu)
2. **"+ Capability"** → **Background Modes** → **tekrar ekleyin**
3. İçindeki option'ları işaretleyin
4. Xcode otomatik olarak Developer Portal'da aktif edecek

Aynısını diğer capability'ler için de yapın:
- Push Notifications (kaldır → ekle)
- Bluetooth LE (kaldır → ekle)
- Location Updates (kaldır → ekle)

