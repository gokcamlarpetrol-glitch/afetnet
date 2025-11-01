# Xcode'da Yapılacak Adımlar (Otomatik Eşleştirme)

## ✅ Proje Dosyası Hazır

- ✅ Release için **Apple Distribution** ayarlandı
- ✅ Automatic signing aktif
- ✅ PROVISIONING_PROFILE_SPECIFIER boş (Xcode otomatik seçecek)
- ✅ DerivedData temizlendi

## 🎯 Xcode'da Şimdi Yapılacaklar

### 1. Xcode'u Kapat ve Aç
- Xcode'u tamamen kapatın (⌘Q)
- Projeyi tekrar açın: `ios/AfetNet.xcworkspace`

### 2. Capability'leri Yeniden Ekle (Xcode Otomatik Olarak Portal'da Açacak)

**Signing & Capabilities** sekmesinde:

1. **Background Modes** → **"-"** butonuyla kaldırın
2. **"+ Capability"** → **Background Modes** → tekrar ekleyin
3. İçinde şunları **işaretleyin**:
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Uses Bluetooth LE accessories (varsa)

4. **Push Notifications** → **"-"** ile kaldır → **"+ Capability"** ile tekrar ekle

5. **Bluetooth LE** → **"-"** ile kaldır → **"+ Capability"** ile tekrar ekle

6. **Location Updates** → **"-"** ile kaldır → **"+ Capability"** ile tekrar ekle

### 3. Profile İndir

1. **Xcode** → **Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID'nizi seçin
4. Team **3H4SWQ8VJL** seçin
5. **"Download Manual Profiles"** butonuna tıklayın
6. Bekleyin (profiller indirilecek)

### 4. Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **Release** konfigürasyonunu seçin (üstteki dropdown'dan)
3. **"Try Again"** butonuna tıklayın
4. Xcode otomatik olarak:
   - Developer Portal'da capability'leri açacak
   - Yeni provisioning profile oluşturacak
   - Profili indirecek ve kullanacak

### 5. Hata Devam Ederse

Eğer hala aynı hata varsa:

1. **Debug** konfigürasyonunu seçin
2. **"Try Again"** yapın
3. Tekrar **Release** seçin
4. **"Try Again"** yapın

---

## 🎉 Başarılı Olursa

- ✅ "Automatic signing succeeded" mesajı göreceksiniz
- ✅ Provisioning Profile "Xcode Managed Profile" görünecek
- ✅ Artık Archive alabilirsiniz!

---

## ⚠️ Not

Capability'leri kaldırıp tekrar eklemek önemli çünkü:
- Xcode bunları kaldırıp eklediğinde **Developer Portal'da otomatik olarak aktif eder**
- Manuel olarak Portal'da açmaya gerek kalmaz!

