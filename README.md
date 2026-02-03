# AfetNet - Afet Hazırlık ve Erken Uyarı Uygulaması

🌍 **Türkiye'nin en kapsamlı afet hazırlık ve erken uyarı mobil uygulaması**

## 🚀 Özellikler

### 🔔 Erken Uyarı Sistemi (EEW)
- P-Dalga tespiti ile saniyeler öncesinden uyarı
- Çok kaynaklı deprem verisi (AFAD, USGS, EMSC)
- Konum bazlı ETA hesaplama

### 📍 Gerçek Zamanlı Deprem Takibi
- Canlı deprem haritası
- Magnitude ve derinlik filtreleme
- Konum bazlı mesafe hesaplama

### 👨‍👩‍👧‍👦 Aile Güvenliği
- Aile üyesi konum paylaşımı
- SOS acil durum bildirimi
- BLE Mesh offline iletişim

### 🆘 Acil Durum Araçları
- Toplanma alanları
- Acil durum kontrol listesi
- Hazırlık planlaması (AI destekli)

### 📰 Afet Haberleri
- Güncel afet haberleri
- AI özet sistemi
- Çok dilli destek

## 📱 Teknik Özellikler

- **Platform**: React Native + Expo
- **State Management**: Zustand
- **Auth**: Firebase + Google/Apple Sign-In
- **Storage**: AsyncStorage + SecureStore
- **Offline**: BLE Mesh Network

## 🛠 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# iOS için pod install
cd ios && pod install && cd ..

# Geliştirme sunucusunu başlat
npx expo start
```

## 📁 Proje Yapısı

```
src/
├── core/
│   ├── components/     # UI bileşenleri
│   ├── hooks/          # Custom React hooks
│   ├── i18n/           # Çoklu dil desteği
│   ├── screens/        # Ekranlar
│   ├── security/       # Güvenlik servisleri
│   ├── services/       # İş mantığı servisleri
│   │   ├── eew/        # EEW modülleri
│   │   └── notifications/ # Bildirim modülleri
│   ├── stores/         # Zustand state yönetimi
│   ├── theme/          # Tema ve stiller
│   └── utils/          # Yardımcı fonksiyonlar
├── eew/                # EEW store ve tipler
├── lib/                # Firebase ve 3rd party setup
└── push/               # Push notification yönetimi
```

## 🔐 Güvenlik

- API key'ler SecureStore ile şifreli depolama
- Firebase App Check entegrasyonu
- Kişisel veri encrytion

## 🌐 Çoklu Dil Desteği

- 🇹🇷 Türkçe (varsayılan)
- 🇬🇧 English

## 📊 Test

```bash
# Tüm testleri çalıştır
npm test

# Coverage raporu
npm run test:coverage
```

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 📞 İletişim

- **Email**: support@afetnet.app
- **Website**: https://afetnet.app

---

**AfetNet** - Hayat kurtarmak için tasarlandı. 🚨
