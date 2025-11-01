# ALTERNATIVE FIX - Developer Portal'da Görünmeyen Capability'ler

## 🔴 DURUM ANALİZİ

Developer Portal'da **Background Modes**, **Bluetooth LE**, **Location Services** görünmüyor çünkü:
- Bu capability'ler **Xcode tarafından otomatik yönetiliyor**
- Portal'da ayrı bir capability olarak eklenmez
- Ancak Xcode bunları Portal'a senkronize etmiyor!

## ✅ ÇÖZÜM: Xcode'u Zorla Portal'a Göndermek

### ADIM 1: Xcode'da Capability'leri TAMAMEN KALDIR

1. **Xcode'u açın**
2. **Signing & Capabilities** sekmesine gidin
3. **Background Modes** → **"-"** butonuna tıklayın → **KALDIRIN**
4. Varsa **Push Notifications** → **"-"** ile kaldırın
5. Varsa **Bluetooth LE** → **"-"** ile kaldırın

### ADIM 2: Xcode'u KAPAT (ÖNEMLİ!)

- Xcode'u tamamen kapatın (⌘Q)

### ADIM 3: Terminal'de Temizlik

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### ADIM 4: Xcode'u AÇ ve Capability'leri YENİDEN EKLE

1. Xcode'u açın
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
3. Apple ID → Team → **"Download Manual Profiles"**
4. Bekleyin

### ADIM 6: Try Again

1. **Signing & Capabilities** → **"Try Again"**
2. Xcode şimdi Developer Portal'a capability'leri **OTOMATIK GÖNDERECEK**

---

## 🚨 EĞER HALA ÇALIŞMAZSA

### Çözüm: Automatic Signing'i Geçici Olarak Kapat

1. **Signing & Capabilities** sekmesinde
2. **"Automatically manage signing"** checkbox'ını **KALDIRIN**
3. **Provisioning Profile** dropdown'ından:
   - Developer Portal'dan manuel bir profile indirin
   - Veya Xcode'un oluşturduğu profile'ı seçin
4. Tekrar **"Automatically manage signing"** açın

Bu, Xcode'u provisioning profile'ı yeniden oluşturmaya zorlar.

---

## ✅ SONUÇ

**Developer Portal'da bu capability'ler görünmüyor çünkü Xcode otomatik yönetiyor.**

**Çözüm:** Capability'leri Xcode'da kaldırıp tekrar ekleyerek Xcode'u Portal'a senkronize etmeye zorlamak.

