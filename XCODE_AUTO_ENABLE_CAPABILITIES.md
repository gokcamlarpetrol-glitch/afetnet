# Xcode Otomatik Capability Etkinleştirme

## 🔴 Sorun
Developer Portal'da capability'ler görünmüyor çünkü bunlar Xcode tarafından otomatik yönetiliyor. Xcode bunları Developer Portal'da aktif etmeli ama etmiyor.

## ✅ Çözüm: Xcode'u Zorla Portal'a Senkronize Et

### Yöntem 1: Capability'leri Kaldırıp Tekrar Ekle (EN ETKİLİ)

**Signing & Capabilities** sekmesinde:

1. **Tüm capability'leri kaldırın:**
   - **Background Modes** → "-" butonuna tıklayın → **SİL**
   - **Push Notifications** → Eğer varsa "-" ile **SİL**
   - **Bluetooth LE** → Eğer varsa "-" ile **SİL**
   - **Location Updates** → Eğer varsa "-" ile **SİL**

2. **Xcode'u kapatıp açın** (önemli!)

3. **Projeyi tekrar açın**

4. **"+ Capability"** butonuna tıklayın ve **SIRAYLA** ekleyin:

   **a) Background Modes:**
   - "+ Capability" → **Background Modes** → Ekle
   - İçinde **TÜMÜNÜ** işaretleyin:
     - ✅ Remote notifications
     - ✅ Background fetch
     - ✅ Background processing
     - ✅ Location updates
     - ✅ Acts as a Bluetooth LE accessory
     - ✅ Uses Bluetooth LE accessories

   **b) Push Notifications:**
   - "+ Capability" → **Push Notifications** → Ekle

   **c) Bluetooth LE:**
   - "+ Capability" → **Bluetooth LE** → Ekle (varsa listede)

5. **Xcode otomatik olarak:**
   - Developer Portal'da App ID'yi güncelleyecek
   - Capability'leri Portal'da **AÇACAK**
   - Yeni provisioning profile oluşturacak

### Yöntem 2: Preferences → Accounts → Download Manual Profiles

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID seçin
4. Team **3H4SWQ8VJL** seçin
5. **"Download Manual Profiles"** butonuna tıklayın
6. Bekleyin (birkaç saniye)

### Yöntem 3: Try Again (Capability'leri ekledikten sonra)

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. Xcode Developer Portal'da capability'leri kontrol edecek ve güncelleyecek

---

## ⚠️ ÖNEMLİ: Kaldırıp Tekrar Eklemek ZORUNLU!

**Neden?**
- Xcode capability'leri **ilk kez eklediğinde** Developer Portal'da aktif eder
- Ama eğer capability'ler zaten varsa (eski projeden kalma), Xcode bunları Portal'da aktif etmeyebilir
- **Kaldırıp tekrar eklemek** Xcode'a "yeni ekliyorum" mesajı verir ve Portal'da otomatik aktif eder

---

## 🎯 Beklenen Sonuç

Capability'leri kaldırıp tekrar ekledikten ve "Try Again" yaptıktan sonra:
- ✅ "Automatic signing succeeded" mesajı
- ✅ Provisioning Profile capability'leri içeriyor
- ✅ Developer Portal'da (kapalı olsa bile) Xcode otomatik açacak

