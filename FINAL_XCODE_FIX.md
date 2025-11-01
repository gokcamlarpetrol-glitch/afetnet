# FINAL XCODE FIX - Developer Portal'da Görünmeyen Capability'ler

## 🔴 SORUN

Developer Portal'da **Background Modes**, **Bluetooth LE**, **Location Services** görünmüyor çünkü:
- Bu capability'ler **Xcode tarafından otomatik yönetiliyor**
- Portal'da ayrı capability olarak eklenmez
- **AMA** Xcode bunları provisioning profile'a eklemiyor!

## ✅ KESİN ÇÖZÜM: Xcode'u Zorla Portal'a Göndermek

### ADIM 1: Xcode'da Capability'leri KALDIR

1. **Xcode'u açın**
2. **Signing & Capabilities** sekmesine gidin
3. **Background Modes** → Sağdaki **"-"** butonuna tıklayın → **KALDIRIN** ✅
4. Varsa **Push Notifications** → **"-"** ile kaldırın
5. Varsa **Bluetooth LE** → **"-"** ile kaldırın

### ADIM 2: Xcode'u KAPAT (ÇOK ÖNEMLİ!)

- Xcode'u tamamen kapatın (⌘Q)

### ADIM 3: Terminal'de Temizlik (YAPILDI ✅)

DerivedData temizlendi.

### ADIM 4: Xcode'u AÇ ve Capability'leri YENİDEN EKLE

1. **Xcode'u açın**
2. Projeyi açın (`ios/AfetNet.xcworkspace`)
3. **Signing & Capabilities** sekmesine gidin
4. **"+ Capability"** butonuna tıklayın
5. **Background Modes** → Ekle
6. İçinde **TÜMÜNÜ** işaretleyin:
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Acts as a Bluetooth LE accessory
   - ✅ Uses Bluetooth LE accessories

7. **"+ Capability"** → **Push Notifications** → Ekle

### ADIM 5: Preferences → Accounts

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID → Team **3H4SWQ8VJL** → **"Download Manual Profiles"**
4. Bekleyin (10-20 saniye)

### ADIM 6: Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. Xcode şimdi:
   - Capability'leri Developer Portal'a gönderecek
   - Yeni provisioning profile oluşturacak
   - Profile capability'leri içerecek

---

## ⚠️ ÖNEMLİ: Adım Sırası

1. ✅ Kaldır (Xcode'da)
2. ✅ Xcode'u kapat
3. ✅ Xcode'u aç
4. ✅ Tekrar ekle
5. ✅ Download Manual Profiles
6. ✅ Try Again

**Bu sırayı değiştirmeyin!**

---

## 🚨 EĞER HALA ÇALIŞMAZSA

### Alternatif: Automatic Signing'i Geçici Kapat

1. **Signing & Capabilities** sekmesinde
2. **"Automatically manage signing"** checkbox'ını **KALDIRIN**
3. Birkaç saniye bekleyin
4. Tekrar **"Automatically manage signing"** **AÇIN**
5. **"Try Again"**

Bu, Xcode'u provisioning profile'ı yeniden oluşturmaya zorlar.

---

## ✅ BEKLENEN SONUÇ

İşlemler tamamlandıktan sonra:
- ✅ "Automatic signing succeeded" mesajı
- ✅ Provisioning Profile capability'leri içeriyor
- ✅ Archive alabilirsiniz

