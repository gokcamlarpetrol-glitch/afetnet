# Xcode Manuel Sertifika Seçimi Rehberi

## Sorun: "Manuel sertifika görmüyorum"

**Sebep:** Xcode'da "Automatically manage signing" açık olduğu için manuel sertifika seçimi gizlidir.

## Çözüm 1: Otomatik Signing'i Kapatarak Manuel Seçim

### Adımlar:

1. **Xcode'u Açın:**
   - `ios/AfetNet.xcworkspace` dosyasını açın

2. **Signing & Capabilities Sekmesine Gidin:**
   - Sol tarafta "AfetNet" target'ını seçin
   - Üstte "Signing & Capabilities" sekmesine tıklayın

3. **"Automatically manage signing" Checkbox'ını KAPATIN:**
   - ✅ işaretini kaldırın
   - Artık aşağıda "Provisioning Profile" ve "Signing Certificate" dropdown'ları görünecek

4. **Manuel Sertifika Seçin:**
   - **Debug için:**
     - "Signing Certificate" → "Apple Development: Gökhan ÇAMCI"
   - **Release için:**
     - "Signing Certificate" → "Apple Distribution: Gökhan ÇAMCI"

5. **Provisioning Profile Seçin:**
   - Eğer manuel profil varsa seçin
   - Yoksa "Download" butonuna tıklayıp indirin

## ⚠️ DİKKAT: Otomatik Signing Daha Kolay

Manuel signing kullanmak şu sorunları getirebilir:
- Her capability değişikliğinde profil yenilemeniz gerekir
- Sertifika süresi dolunca manuel yenileme gerekir
- Archive için farklı profil gerekebilir

## Çözüm 2: Otomatik Signing'i Düzelt (Önerilen)

Önce otomatik signing'i çalışır hale getirelim:

### Adım 1: Xcode'da Yapılacaklar

1. **Xcode'u kapatıp açın** (⌘Q → tekrar açın)

2. **Preferences → Accounts:**
   - ⌘, (virgül) ile açın
   - "Gökhan ÇAMCI" hesabını seçin
   - "Download Manual Profiles" butonuna tıklayın
   - Tüm profilleri indirin

3. **Signing & Capabilities:**
   - "Automatically manage signing" ✅ AÇIK OLSUN
   - "Team" → "Gökhan ÇAMCI" seçili olsun

4. **Her Capability'yi Tekrar Ekleyin:**
   - "+ Capability" butonuna tıklayın
   - **Background Modes** → ekleyin, işaretleyin:
     - ✅ Background fetch
     - ✅ Remote notifications
     - ✅ Location updates
     - ✅ Bluetooth LE acts as central/peripheral
   
   - **Push Notifications** → ekleyin
   - **Location Services** → zaten açık olabilir

5. **Her Capability'yi Kaldırıp Tekrar Ekleyin:**
   - Bu, Xcode'un Developer Portal'a senkronize olmasını zorlar
   - "-" butonuna tıklayıp kaldırın
   - Sonra tekrar "+ Capability" ile ekleyin

6. **Clean Build Folder:**
   - ⌘⇧K (Product → Clean Build Folder)

7. **Tekrar Deneyin:**
   - "Try Again" butonuna tıklayın
   - Eğer hala hata varsa → sonraki adım

### Adım 2: Apple Developer Portal'da Kontrol

1. **https://developer.apple.com/account** → açın

2. **Certificates, Identifiers & Profiles** → tıklayın

3. **Identifiers** → "AfetNet" (com.gokhancamci.afetnetapp) → tıklayın

4. **Capabilities Kontrolü:**
   Şunların hepsi ✅ işaretli olmalı:
   - ✅ Push Notifications
   - ✅ Background Modes
   - ✅ Bluetooth LE (Central)
   - ✅ Bluetooth LE (Peripheral)
   - ✅ Location Services
   - ✅ In-App Purchase
   - ✅ Associated Domains

5. **Eğer eksik varsa:**
   - Edit → checkbox'ları işaretleyin → Save

6. **Profiles Kontrolü:**
   - **Profiles** → "afetnet iOS app" (veya benzeri) → tıklayın
   - "Edit" → Capabilities kısmında tüm capability'lerin seçili olduğundan emin olun
   - "Generate" → Yeniden oluşturun

### Adım 3: Xcode'a Geri Dön

1. **Preferences → Accounts → Download Manual Profiles**

2. **Signing & Capabilities → Try Again**

## Hangi Çözümü Seçmeliyim?

- **Otomatik Signing (Önerilen):** Kolay, Xcode her şeyi yönetir
- **Manuel Signing:** Daha fazla kontrol, ama daha fazla manuel iş

## Debug vs Release Farkı

- **Debug:** Apple Development sertifikası + Development profili
- **Release (Archive):** Apple Distribution sertifikası + Distribution profili

Otomatik signing açıkken Xcode bunu otomatik yapar.

---

## Sorun Devam Ederse

1. Xcode caches temizlendi ✅ (zaten yapıldı)
2. DerivedData temizlendi ✅ (zaten yapıldı)
3. Developer Portal'da capability'ler açık mı kontrol edin
4. Xcode → Preferences → Accounts → Download Profiles
5. Capability'leri kaldırıp tekrar ekleyin (Xcode'un senkronize olması için)












