# AfetNet - Şebekesiz Acil İletişim Platformu

**Türkiye'nin İlk BLE Mesh Tabanlı Acil Durum İletişim Uygulaması**

---

## 🌟 Benzersiz Özellikler

AfetNet, diğer tüm deprem uygulamalarından farklı olarak **internet olmadan çalışan** özgün bir platformdur.

### 1. 🔵 BLE Mesh Offline Messaging (Türkiye'de İlk)
- **İnternet olmadan mesajlaşma**: Deprem sonrası şebeke çöktüğünde bile iletişim
- **Mesh routing**: Mesajlar cihazdan cihaza aktarılarak uzak mesafelere ulaşır
- **Persistent queue**: Mesaj kaybı yok - şebeke gelince otomatik gönderilir
- **E2E encryption**: Curve25519 + Salsa20 ile askeri seviye güvenlik
- **Custom implementation**: Hiçbir 3. parti BLE mesh kütüphanesi kullanılmadı

### 2. 📳 Seismic Sensor P/S Wave Detection (Dünyada Nadir)
- **100 Hz sampling**: Telefonunuzu profesyonel sismografa dönüştürür
- **P-wave algılama**: 0.45 m/s² threshold ile erken tespit
- **S-wave algılama**: 0.75 m/s² threshold ile güvenilir doğrulama
- **Community verification**: 3+ cihaz ile false positive önleme
- **ML magnitude estimation**: Yapay zeka ile deprem büyüklüğü tahmini
- **Orijinal algoritma**: Kendimiz geliştirdik, hiçbir library kullanılmadı

### 3. 🏚️ Enkaz Algılama (Benzersiz)
- **Otomatik düşme tespiti**: IMU sensörleri ile düşme algılama
- **Hareketsizlik izleme**: Enkaz altında kaldığınızı anlar
- **Otomatik SOS**: Kullanıcı müdahalesi olmadan yardım çağrısı
- **Battery-optimized**: Batarya tüketimi minimize edildi

### 4. 📡 Multi-Channel Emergency Broadcasting
- **BLE Mesh**: Offline - şebeke olmadan
- **Firebase Realtime**: Online - gerçek zamanlı sync
- **Backend API**: Structured data storage
- **Simultaneous**: Tüm kanallar aynı anda çalışır
- **Guaranteed delivery**: En az bir kanal mutlaka çalışır

### 5. 🤖 AI-Powered Features
- **Risk Scoring**: OpenAI GPT-4 ile kişiselleştirilmiş risk analizi
- **Preparedness Plans**: AI ile hazırlık planı oluşturma
- **News Summarization**: Deprem haberlerini AI özetler
- **Panic Assistant**: Panik anında adım adım yönlendirme

---

## 🎯 Diğer Deprem Uygulamalarından Farkımız

| Özellik | AfetNet | Diğer Uygulamalar |
|---------|---------|-------------------|
| **Şebekesiz Mesajlaşma** | ✅ BLE Mesh | ❌ Yok |
| **P/S Dalga Algılama** | ✅ 100 Hz sensor | ❌ Yok |
| **Enkaz Otomatik SOS** | ✅ IMU-based | ❌ Yok |
| **E2E Encryption** | ✅ Curve25519 | ⚠️ Kısıtlı |
| **Offline-First** | ✅ Tam destek | ⚠️ Sınırlı |
| **AI Asistan** | ✅ GPT-4 | ❌ Yok |
| **Community Verify** | ✅ 3+ device | ❌ Yok |
| **Mesh Routing** | ✅ Custom impl | ❌ Yok |

---

## 🔬 Teknik Detaylar

### Özgün Algoritmalar
- **BLE Mesh Router**: Sıfırdan yazılmış mesh routing algoritması
- **Seismic Detection**: Orijinal P/S dalga algılama algoritması
- **Enkaz AI**: Custom fall + immobility detection
- **Wave Calculation**: Elite dalga yayılım hesaplaması
- **Encryption Layer**: Özgün E2E şifreleme katmanı

### Kullanılan Teknolojiler
- **React Native 0.81.5**: UI framework
- **Expo 54**: Development platform
- **BLE PLX**: Bluetooth Low Energy (custom mesh layer ile)
- **Firebase**: Realtime sync (custom data structure)
- **OpenAI GPT-4**: AI features (custom prompts)
- **PostgreSQL**: Backend database (custom schema)

### Özgün UI/UX
- **Custom design system**: Hiçbir UI library/template kullanılmadı
- **Earthquake-optimized**: Deprem senaryoları için özel tasarım
- **Accessibility**: Tam erişilebilirlik desteği
- **Offline-first UX**: Network olmadan da kullanılabilir arayüz

---

## 🚀 Kurulum ve Geliştirme

```bash
# Dependencies
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Production build
eas build -p ios --profile production
```

---

## 📱 Özellikler

### Temel Özellikler (Ücretsiz)
- Gerçek zamanlı deprem izleme (AFAD)
- Deprem haritası
- Acil SOS butonu
- Temel bildirimler

### Premium Özellikler
- BLE Mesh offline mesajlaşma
- P/S dalga algılama ve erken uyarı
- Enkaz algılama ve otomatik SOS
- AI risk analizi ve hazırlık planı
- Aile güvenlik zinciri
- Gelişmiş harita katmanları
- AI haber özeti

---

## 🛡️ Güvenlik

- **E2E Encryption**: Curve25519 + Salsa20 + Poly1305
- **SecureStore**: iOS Keychain / Android Keystore
- **HMAC-SHA256**: API request signatures
- **Firebase Rules**: Strict validation
- **Zero hardcoded keys**: Tüm key'ler EAS secrets'ta

---

## 📄 Lisans

ISC License

---

## 👥 Ekip

AfetNet Team - Türkiye'deki deprem riskini azaltmak için geliştiriliyor

---

## 📞 Destek

- Email: support@afetnet.app
- Website: https://gokhancamci.github.io/AfetNet1

---

**Not**: Bu uygulama özgün bir projedir. Hiçbir template, boilerplate veya 3. parti kod kopyalanmamıştır. Tüm özellikler deprem acil durum senaryoları için özel olarak geliştirilmiştir.
