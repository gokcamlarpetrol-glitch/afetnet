# Developer Portal - Tam Çözüm Kılavuzu

## 🔴 Sorun

Xcode capability'leri gösteriyor ama **Developer Portal'da App ID'de aktif değil**. 
Automatic signing, **yalnızca Portal'da aktif olan capability'lere göre** provisioning profile oluşturur.

## ✅ KESİN ÇÖZÜM

### Developer Portal'a Gidin

https://developer.apple.com/account/resources/identifiers/list

### App ID'yi Düzenleyin

1. `com.gokhancamci.afetnetapp` App ID'yi bulun
2. Üzerine tıklayın → **Edit** butonuna tıklayın

### ⚠️ ÖNEMLİ: İKİ FARKLI TAB VAR!

Developer Portal'da App ID edit sayfasında **üstte 3 tab var**:

1. **"Capabilities"** tab (Liste - Push, In-App Purchase, etc.)
2. **"App Services"** tab (Background Modes, Bluetooth, Location Services)
3. **"Capability Requests"** tab (Onay bekleyen istekler)

### Adım 1: "Capabilities" Tab'ında (Birinci Tab)

**ENABLE checkbox'ını işaretleyin:**

1. ✅ **Push Notifications** → ENABLE
   - **Configure** butonuna tıklayın
   - Key oluşturmanız gerekebilir veya mevcut key'i seçin

2. ✅ **Associated Domains** → ENABLE

3. ✅ **In-App Purchase** → ENABLE

4. ✅ **Apple Pay Payment Processing** → ENABLE
   - **Edit** butonuna tıklayın
   - Merchant ID'lerinizi kontrol edin

5. ✅ **Location Push Service Extension** → ENABLE

### Adım 2: "App Services" Tab'ına Gidin (İkinci Tab)

Bu tab'da **Background Modes**, **Bluetooth**, **Location Services** bulunur.

1. Tab'ları gezin → **"App Services"** tab'ını bulun
2. İçinde şunları bulun ve ENABLE yapın:
   - ✅ **Background Modes** (veya "Background Processing")
   - ✅ **Bluetooth LE** (veya "Bluetooth")
   - ✅ **Location Services** (veya "Location")

**Not:** Eğer "App Services" tab'ı yoksa, bu capability'ler Xcode tarafından otomatik yönetilir demektir - o zaman Xcode'da capability'leri kaldırıp tekrar eklemek yeterli.

### Adım 3: Save

1. **Save** butonuna tıklayın
2. **30 saniye bekleyin** (Apple'ın sunucularında senkronize olması için)

---

## 🎯 Xcode'da Son Adımlar

### 1. Download Manual Profiles

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID → Team **3H4SWQ8VJL**
4. **"Download Manual Profiles"** → Tıklayın
5. Bekleyin

### 2. Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. Xcode yeni profile'ı indirecek ve capability'leri içerecek

---

## 🔍 Eğer "App Services" Tab'ı Yoksa

O zaman bu capability'ler **Xcode tarafından otomatik yönetiliyor** demektir.

**Çözüm:**
1. Xcode'da capability'leri **kaldırıp tekrar ekleyin**
2. Xcode otomatik olarak Portal'da aktif edecek
3. Try Again yapın

---

## ✅ Kontrol Listesi

Developer Portal'da:
- ⬜ "Capabilities" tab'ında Push, In-App Purchase, Apple Pay, Location Push Extension açık mı?
- ⬜ "App Services" tab'ı var mı? Varsa Background Modes, Bluetooth, Location açık mı?
- ⬜ Save yaptınız mı?
- ⬜ 30 saniye beklediniz mi?

Xcode'da:
- ⬜ Download Manual Profiles yaptınız mı?
- ⬜ Try Again yaptınız mı?

---

## 🎉 Beklenen Sonuç

İşlemler tamamlandıktan sonra:
- ✅ "Automatic signing succeeded"
- ✅ Provisioning Profile tüm capability'leri içeriyor
- ✅ Archive alabilirsiniz

