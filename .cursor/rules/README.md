# Cursor Rules for AfetNet

Bu dizin AfetNet acil durum iletişim uygulaması için Cursor 2.0 multi-agent kurallarını içerir. 

Tüm kurallar Cursor Directory (cursor.directory/rules/popular) popüler kurallardan, React Native, Expo, TypeScript ve mobil geliştirme best practice'lerinden ilham alınarak oluşturulmuştur.

## Kural Dosyaları (15 adet)

### Core Development Rules

1. **architecture.mdc** - Mimari desenler (offline-first, service-oriented)
2. **typescript-best-practices.mdc** - TypeScript standartları (alwaysApply: true)
3. **react-native-conventions.mdc** - React Native + Expo konvansiyonları

### Performance & Quality

4. **performance-optimization.mdc** - Mobil performans optimizasyonları (alwaysApply: true)
5. **ui-styling.mdc** - UI ve styling standartları
6. **state-management.mdc** - Zustand ve state yönetimi

### Security & Reliability

7. **security-secrets.mdc** - Güvenlik ve secrets yönetimi (alwaysApply: true)
8. **error-handling.mdc** - Hata yönetimi ve dayanıklılık (alwaysApply: true)

### Internationalization & Testing

9. **localization-i18n.mdc** - i18next ve erişilebilirlik
10. **testing-quality.mdc** - Jest, E2E, health checks

### Platform-Specific

11. **platform-permissions.mdc** - iOS/Android izinler ve entitlements
12. **ble-mesh-networking.mdc** - BLE mesh ve offline networking

### Deployment & Release

13. **ci-cd-eas.mdc** - EAS Build ve CI/CD workflows
14. **release-store-readiness.mdc** - App Store & Play Store hazırlık
15. **dependencies-versions.mdc** - Bağımlılık ve versiyon yönetimi

## Kullanım

Cursor otomatik olarak bu kuralları yükler ve uygun context'lerde kullanır:

- **alwaysApply: true** olan kurallar her zaman uygulanır
- **globs** pattern'lere göre ilgili dosyalarda uygulanır
- Feature-specific kurallar (BLE, mesh) sadece ilgili modüllerde aktif

## Kaynaklar

- Cursor Directory: https://cursor.directory/rules/popular
- Expo Docs: https://docs.expo.dev/
- React Native Docs: https://reactnative.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

## Projeye Özel Konfigürasyonlar

Bu kurallar AfetNet'in özelliklerine göre özelleştirilmiştir:

- Offline-first mimari (SQLite + queue)
- BLE mesh networking
- Earthquake Early Warning (EEW) sistemi
- Military-grade security
- Emergency communication features
- Multi-platform (iOS + Android) desteği

---

**RULES SET CREATED: 15 files**
