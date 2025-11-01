# KESİN ÇÖZÜM - Web Araştırmasına Göre

## 🔴 Kök Sorun (Web Araştırması Sonucu)

**Sorun:** Xcode capability'leri gösteriyor ama **Developer Portal'da App ID'de bu capability'ler aktif değil**. 
Automatic signing, App ID'deki aktif capability'lere göre provisioning profile oluşturuyor.
Eğer Portal'da kapalıysa, profile'da da olmuyor.

## ✅ KESİN ÇÖZÜM: Developer Portal'da Manuel Aktif Etme

Web araştırmasına göre, bazı capability'ler **Xcode otomatik olarak açmaz** - manuel açmak gerekiyor.

### Adım 1: Developer Portal'a Gidin

https://developer.apple.com/account/resources/identifiers/list

### Adım 2: App ID'yi Düzenleyin

1. `com.gokhancamci.afetnetapp` → **Edit**
2. **Capabilities** sekmesine gidin (üstteki tab'lar)

### Adım 3: Capability'leri Açın

**ENABLE checkbox'ını işaretleyin:**

1. ✅ **Push Notifications** → ENABLE
   - Bu listede **KESİNLİKLE** görünmeli
   - Configure butonuna tıklayın (Key varsa seçin, yoksa "Create Key" yapın)

2. ✅ **Associated Domains** → ENABLE

3. ✅ **In-App Purchase** → ENABLE

4. ✅ **Apple Pay Payment Processing** → ENABLE
   - Edit → Merchant ID seçin

5. ✅ **Location Push Service Extension** → ENABLE

### Adım 4: Background Modes ve Bluetooth

**Bu capability'ler listede görünmeyebilir** çünkü bunlar **Background Modes** ve **Bluetooth LE** olarak App Services içinde.

**Çözüm:**
- Developer Portal'da **"App Services"** tab'ına gidin
- **Background Modes** → ENABLE
- İçinde işaretleyin: Fetch, Remote notifications, Location updates, etc.

### Adım 5: Save

**Save** butonuna tıklayın ve bekleyin (birkaç saniye).

---

## 🎯 Xcode'da Sonra

1. **Xcode → Preferences → Accounts**
2. **Download Manual Profiles** → Tıklayın
3. **Signing & Capabilities** → **"Try Again"**

---

## ⚠️ ÖNEMLİ: "App Services" Tab'ı

Developer Portal'da App ID edit sayfasında:
- **"Capabilities"** tab → Liste (Push, In-App Purchase, etc.)
- **"App Services"** tab → Background Modes, Bluetooth, Location Services
- **İKİSİNİ DE kontrol edin!**

---

## 🔍 Kontrol

Developer Portal'da capability'leri açtıktan sonra:
1. **Save** yapın
2. 30 saniye bekleyin (Apple'ın senkronize etmesi için)
3. Xcode'da **Download Manual Profiles**
4. **Try Again**

