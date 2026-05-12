# iPad Responsive Audit — AfetNet

> **Sprint:** v2 Sprint 8 — iPad responsive layout (5 ana ekran)
> **Tarih:** 2026-05-11
> **Hedef:** AfetNet'i iPad'de profesyonel goruntude. Apple App Store kurali (Universal binary olunca her cihazda iyi gosterilmeli).

---

## Mevcut Durum

AfetNet su an `compactWidth + compactHeight` (iPhone) icin optimize edilmis. iPad'de:
- Tum ekranlar tam ekran tek-kolon (iPhone gibi gerilmis)
- Tablet/iPad hedeflenmedigi icin (`app.config.ts` ios.supportsTablet kontrol et) tek-yonlu acilis
- Buyuk ekran avantaji kullanilmiyor

## Hedef

5 ana ekranda **Split View** veya **Grid Layout** ile iPad'de daha buyuk ekran avantajini kullan. Hedef ekranlar:

### 1. Home Screen
- **iPhone:** Tek kart yigini, dikey scroll
- **iPad portrait:** 2 kolon (sol: SOS / EEW dashboard | sag: son depremler + aile durumu)
- **iPad landscape:** 3 kolon (sol: sidebar nav | merkez: dashboard | sag: aile)

### 2. Family Screen
- **iPhone:** Uye listesi tek kolon
- **iPad portrait:** Master-Detail (sol kolon uye listesi | sag detay)
- **iPad landscape:** Liste + harita yan yana

### 3. Disaster Map
- **iPhone:** Tam ekran harita + bottom-sheet
- **iPad:** Sol panelde filter listesi (toplanma alani, hastane, sığınak, son depremler), sağ ana harita

### 4. Messages
- **iPhone:** Conversation listesi → tıkla → ConversationScreen
- **iPad portrait:** Master-Detail (sol liste | sag aktif sohbet)
- **iPad landscape:** Aynisi + sag panel attachment/file viewer

### 5. Settings
- **iPhone:** Tek scrollable list
- **iPad:** 2 kolon (sol kategori navigation | sag aktif kategori icerigi) — Apple Music tarzi

## Teknik Yaklasim

### Adim 1 — `useWindowDimensions` ile mevcut breakpoint
```ts
import { useWindowDimensions } from 'react-native';

const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  return { isTablet, isLandscape, width, height };
};
```

### Adim 2 — `react-native-safe-area-context` insets'i kontrol et
iPad'de notch yok ama Home indicator var; padding ayarla.

### Adim 3 — Master-Detail wrapper
```tsx
function ResponsiveMasterDetail({ master, detail }: { master: ReactNode; detail: ReactNode }) {
  const { isTablet } = useResponsive();
  if (!isTablet) return master; // iPhone fallback
  return (
    <View style={styles.row}>
      <View style={styles.master}>{master}</View>
      <View style={styles.detail}>{detail}</View>
    </View>
  );
}
```

### Adim 4 — `app.config.ts` etkinlestir
```ts
ios: {
  supportsTablet: true, // su an muhtemelen false veya yok
}
```

### Adim 5 — App Store Connect screenshots
- iPad screenshot'lari ayri olarak yuklenmeli (iPad Pro 12.9", iPad Pro 11")

## Test Plani

1. iOS simulator: iPad Pro 12.9" (6th gen), iPad Air (5th gen)
2. Yatay/dikey rotasyon (her ekran iki yonelimde test)
3. Stage Manager — pencere boyutlandirma
4. Split View (yan yana iki app)

## Tahmini Sure

| Faz | Sure |
|---|---|
| Responsive utilities + breakpoints | 4 saat |
| Home Screen iPad layout | 6 saat |
| Family Screen iPad layout | 8 saat |
| Disaster Map iPad layout | 12 saat (harita zor) |
| Messages iPad layout | 10 saat |
| Settings iPad layout | 4 saat |
| Test + bug fix + screenshot | 16 saat |
| **TOPLAM** | **60 saat** (~2 hafta tam zamanlı) |

## Risk

- App Store policy: iPad supportsTablet=true ise tum ekranlar iPad'de iyi goruntulenmeli yoksa reddedilir.
- Mevcut bug'lar iPad'de daha gorunur olabilir (kucuk text, hatali padding)

---

**ONERILEN STRATEJI:** Sprint 8 yerine Sprint 13 (QA Game Day) sonrasi yapilmali. Once mobil bug'lar tamamen kapatilmali.
