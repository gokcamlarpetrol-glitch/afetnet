# Arapca (AR) Localization + RTL Plan — AfetNet

> **Sprint:** v2 Sprint 9 — AR RTL layout + 4M+ Suriyeli kullanici hedef
> **Tarih:** 2026-05-11
> **Hedef:** AfetNet'i Turkiye'de yasayan ~4M Suriyeli ve diger Arapca konusan toplumlara erisilebilir kilmak. Bu **hayat kurtaran** bir uygulama; dil engeli olmamalidir.

---

## Mevcut Durum

- AfetNet **sadece Turkce** (tum string'ler hardcoded)
- I18n altyapisi var ama tek dil yukleniyor (`i18nService.ts`)
- RTL (right-to-left) hicbir yerde desteklenmiyor
- AR fontlar (Arabic) bundle'da yok

## Hedef Dil Listesi (Oncelik)

1. **Arapca (AR)** — ~4M Suriyeli + Iraqli (Mardin, Sanliurfa, Gaziantep, Kilis, Hatay)
2. **Ingilizce (EN)** — Turist + uluslararasi sivilller
3. **Kurtce (Sorani + Kurmanji)** — Guneydogu Anadolu
4. **Farsca (FA)** — Iran sinir illeri

## Teknik Yaklasim

### Adim 1 — I18n Altyapisini Multi-Lang'a Cevir

`src/core/services/I18nService.ts`'i guncelle:
- `i18n-js` ya da `react-i18next` ile dinamik dil yukleme
- Dil dosyalari: `src/core/i18n/{tr,ar,en,ku,fa}.json`
- Cihaz dili (Localization.locale) yoksa kullanici secimi (settingsStore.preferredLanguage)

### Adim 2 — Tum Hardcoded Turkce String'leri Cikar

Tahmini sayilar:
- Screens: ~80 ekran × ortalama 20 string = 1600 string
- Components: ~200 component × 5 string = 1000 string
- Errors/alerts/notifications: ~300 string
- **TOPLAM:** ~2900 string

Toplu islem icin script:
```bash
# Tum 'literal'.length(min:8) string'leri bul
grep -rn ".*'[ğüşıöçĞÜŞİÖÇa-z]\{10,\}'" src/core --include="*.tsx" \
  | awk -F: '{print $1}' | sort -u
```

### Adim 3 — RTL Layout Destek

```tsx
// src/core/utils/rtl.ts
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

export const isRTL = () => I18nManager.isRTL;

// Logical properties (marginStart yerine marginLeft)
export const dirStyle = (rtlValue: any, ltrValue: any) => isRTL() ? rtlValue : ltrValue;

// App boot'ta:
export async function configureRTL(preferredLang?: string) {
  const locale = preferredLang || Localization.getLocales()[0]?.languageCode || 'tr';
  const shouldBeRTL = ['ar', 'fa', 'he'].includes(locale);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    // App restart gerekli! React Native I18nManager hot-reload yapmaz
    return { restartRequired: true };
  }
  return { restartRequired: false };
}
```

### Adim 4 — Stylesheet'lerde `marginLeft`/`right` Yerine `marginStart`/`end`

Bu tarama-degisiklik bir gunluk is. Tum stylesheets'i tar:
```bash
grep -rn "marginLeft\|marginRight\|paddingLeft\|paddingRight\|left:\|right:" \
  src/core/screens src/core/components --include="*.ts" --include="*.tsx"
```

Manuel donusum (sed degil — context onemli):
- `marginLeft` → `marginStart`
- `marginRight` → `marginEnd`
- `paddingLeft` → `paddingStart`
- `paddingRight` → `paddingEnd`
- `left:` → `start:`
- `right:` → `end:`

### Adim 5 — Arapca Font (Noto Sans Arabic)

```ts
// app.config.ts plugins
plugins: [
  [
    'expo-font',
    {
      fonts: ['./assets/fonts/NotoSansArabic-Regular.ttf', './assets/fonts/NotoSansArabic-Bold.ttf'],
    },
  ],
]
```

### Adim 6 — Apple/Android Locale Manifest

```ts
// app.config.ts
locales: {
  ar: './assets/locales/ar.json',
  en: './assets/locales/en.json',
  tr: './assets/locales/tr.json',
  ku: './assets/locales/ku.json',
  fa: './assets/locales/fa.json',
}
```

App Store ve Play Store, manifest'te listelenen dilleri otomatik olarak metadata sayfasinda gosterir.

## Ceviri Stratejisi

### Yontem 1 — Profesyonel Tercume (Onerilen)
- Bir Suriyeli/Iraqli native speaker tutarak afet/teknik terimleri uygun cevirisi
- Maliyet: ~$500-1000 (2900 string)
- Sure: 1-2 hafta

### Yontem 2 — DeepL + Native Review
- DeepL API ile bulk ceviri
- Native speaker review ve duzeltme
- Maliyet: ~$100-300 (DeepL ucreti)
- Sure: 3-5 gun

### Yontem 3 — Toplulukla Crowdsource
- Crowdin.com gibi platformda toplulukla ceviri
- Ucretsiz ama yavas
- Sure: 1-3 ay

## Test Plani

1. Cihazda dil degistir (Settings → Language → AR/EN/...)
2. Tum ekranlari gezin — text taşma var mı?
3. RTL: tum ikonlar dogru tarafta mi?
4. Notification: lokalize edilmis mi?
5. Push notification: backend lang param ile gonderiyor mu?

## Tahmini Sure

| Faz | Sure |
|---|---|
| I18n altyapi kurulum | 6 saat |
| Tum hardcoded string'leri cikar | 24 saat |
| AR ceviri (profesyonel) | 1-2 hafta paralel |
| RTL stylesheet donusumu | 12 saat |
| Font ekleme + bundle | 2 saat |
| Locale manifest + store metadata | 3 saat |
| Test + bugfix | 16 saat |
| **TOPLAM** | **~70 saat + 1-2 hafta ceviri** |

## Risk

- Ceviri kalitesi dusuk olursa kullanici hatali bilgi alabilir (life-safety!)
- RTL bug'lar (icon yon, padding, indicator) bazi ekranlarda saatlerce kacirilabilir
- App store: AR icin ayri screenshot setleri gerek

## ONERILEN STRATEJI

1. **Sprint 9 olarak EN baslama** — Sadece i18n altyapisi + TR/EN
2. **Sprint 10 olarak AR ekle** — RTL + Arapca ceviri
3. **Sprint 11 olarak diger diller** — Sorani, Farsca

---

**Hazirlayan:** AfetNet Elite Team — Sprint 9 plan
**Tarih:** 2026-05-11
