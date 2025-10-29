# KESİN ÇÖZÜM - Adım Adım

## 🔴 Mevcut Sorun
Xcode capability'leri görüyor ama provisioning profile oluştururken eklemiyor çünkü Developer Portal'daki App ID'de bu capability'ler kapalı.

## ✅ KESİN ÇÖZÜM (3 Yöntem)

### YÖNTEM 1: Capability'leri Tamamen Kaldırıp Xcode'u Kapat (EN ETKİLİ)

1. **Signing & Capabilities** sekmesinde:
   - **Background Modes** → "-" butonuna tıklayın → **TAMAMEN KALDIRIN**
   - Varsa **Push Notifications** → "-" ile kaldırın
   - Varsa **Bluetooth LE** → "-" ile kaldırın

2. **Xcode'u TAMAMEN KAPATIN** (⌘Q - önemli!)

3. **Terminal'de temizlik yapın:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```

4. **Xcode'u açın ve projeyi açın**

5. **"+ Capability"** → **Background Modes** → Ekle
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Uses Bluetooth LE accessories

6. **"+ Capability"** → **Push Notifications** → Ekle

7. **Signing & Capabilities** → **"Try Again"**

### YÖNTEM 2: Preferences → Accounts → Refresh (Portal Senkronizasyonu)

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID'nizi seçin
4. Team'i seçin
5. **"Download Manual Profiles"** → Tıklayın
6. **"Manage Certificates"** → Tıklayın (sadece sertifikaları görmek için)
7. **Kapatın**
8. **Signing & Capabilities** → **"Try Again"**

### YÖNTEM 3: Manual Provisioning Profile Seç (Geçici Çözüm)

Eğer yukarıdakiler çalışmazsa:

1. **Signing & Capabilities** sekmesinde
2. **"Automatically manage signing"** checkbox'ını **KALDIRIN** (işaretini kaldırın)
3. **Provisioning Profile** dropdown'ından:
   - Developer Portal'dan indirdiğiniz profile'ı seçin
   - Veya **"+ Capability"** ekledikten sonra tekrar "Automatically manage signing" açın

---

## ⚠️ ÖNEMLİ: Adım Sırası

1. **Önce:** Capability'leri kaldır
2. **Sonra:** Xcode'u kapat → Terminal'de temizlik
3. **Sonra:** Xcode'u aç → Capability'leri tekrar ekle
4. **En son:** Try Again

**Bu sırayı takip etmezseniz çalışmaz!**

---

## 🔍 Kontrol Listesi

Proje dosyası hazır:
- ✅ SystemCapabilities eklendi
- ✅ CODE_SIGN_STYLE = Automatic
- ✅ Entitlements doğru
- ✅ Info.plist doğru

Xcode'da yapılacaklar:
- ⬜ Capability'leri kaldır
- ⬜ Xcode'u kapat
- ⬜ Terminal'de temizlik
- ⬜ Xcode'u aç
- ⬜ Capability'leri tekrar ekle
- ⬜ Try Again

