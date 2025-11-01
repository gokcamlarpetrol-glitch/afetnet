# Signing Certificate Açıklaması

## ✅ "Apple Development" Normal mi?

**EVET, NORMAL!** 

### Neden?

1. **"All" veya "Debug" konfigürasyonunda:**
   - ✅ **Apple Development** doğru sertifika (cihazda test için)

2. **"Release" konfigürasyonunda:**
   - ✅ **Apple Development** görünebilir (normal)
   - ✅ **Archive alırken** Xcode otomatik olarak **Apple Distribution** kullanır

### Xcode'un Mantığı:

- **Automatically manage signing** açıkken:
  - Debug/Daily builds için → **Apple Development** kullanır
  - **Archive alırken** → Xcode otomatik olarak **Apple Distribution** seçer
  - Bu değişim otomatik olur, ekrana yansımayabilir

## 🎯 Archive Almak İçin

1. **Scheme'i kontrol edin:**
   - Üstte **"AfetNet" > "Any iOS Device (arm64)"** görünmeli

2. **Archive alın:**
   - **Product → Archive** (⌥⌘B)
   - Xcode otomatik olarak **Apple Distribution** kullanacak

3. **Archive başarılı olursa:**
   - Organizer açılır
   - Archive'da "Distribution" sertifikası kullanılmış olacak

## ⚠️ ÖNEMLİ

**Signing hatası varsa (capability sorunu) önce onu çözmeliyiz!**

Signing & Capabilities sekmesinde:
- Üstte **"Release"** seçili olsun
- "Try Again" yapın
- Eğer hata düzelirse, Archive alırken otomatik olarak Distribution kullanılacak

---

## ✅ Özet

- **"Apple Development" gözükmesi NORMAL** ✅
- **Archive alırken otomatik olarak Distribution kullanılır** ✅
- **Önce signing hatasını çözmeliyiz** ⚠️

