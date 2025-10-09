# Gizlilik Politikası - AfetNet

## Veri Toplama ve Saklama

AfetNet uygulaması **tamamen çevrimdışı** çalışmak üzere tasarlanmıştır. Uygulama:

### Yerel Olarak Saklanan Veriler:
- **Konum verileri**: GPS ve PDR (Pedestrian Dead-Reckoning) ile elde edilen konum bilgileri
- **BLE mesajları**: Yakın cihazlarla paylaşılan acil durum mesajları
- **Aile üyeleri**: QR kod ile eşleştirilen aile üyesi bilgileri
- **Harita önbelleği**: Çevrimdışı kullanım için indirilen harita karoları
- **Deprem verisi**: Son deprem bilgileri (sadece yerel önbellek)
- **Uygulama ayarları**: Kullanıcı tercihleri ve konfigürasyon

### Şifreleme:
- Tüm yerel veriler cihazda şifrelenerek saklanır
- BLE mesajları TweetNaCl ile şifrelenir (aile üyeleri arasında)
- Genel acil durum mesajları şifresizdir (hız için)

## Veri Paylaşımı

### Otomatik Paylaşım YOK:
- **Hiçbir veri otomatik olarak sunuculara gönderilmez**
- **Hiçbir veri üçüncü taraflarla paylaşılmaz**
- **Hiçbir veri analiz için toplanmaz**

### Manuel Paylaşım:
- Kullanıcı açık onayı ile:
  - Aile üyeleri arasında konum paylaşımı (QR kod ile eşleşme)
  - Acil durum mesajları (BLE ile yakın cihazlara)
  - Geliştirici günlükleri (sadece hata raporlama için)

## BLE (Bluetooth Low Energy)

### Yakın Mesajlaşma:
- Sadece 10-50 metre mesafedeki cihazlarla iletişim
- Mesajlar otomatik olarak silinir (TTL sistemi)
- Görülen mesaj ID'leri yerel olarak saklanır (döngü önleme)

### Kimlik:
- Her cihaz benzersiz bir anahtar çifti oluşturur
- Kişisel bilgi içermez
- Cihaz yeniden kurulumunda değişir

## İzinler

### Konum:
- **Amaç**: Enkaz bölgesi belirleme ve çevrimdışı harita
- **Kullanım**: Sadece acil durumlarda ve kullanıcı talebi ile

### Bluetooth:
- **Amaç**: Yakın cihazlarla şebekesiz iletişim
- **Kullanım**: Sadece AfetNet uygulaması tarafından

### Mikrofon:
- **Amaç**: Enkaz altında tıklama/çarpma algısı (isteğe bağlı)
- **Kullanım**: Sadece kullanıcı etkinleştirirse

## Veri Silme

- Uygulama kaldırıldığında tüm veriler silinir
- Manuel olarak "Tüm Verileri Temizle" seçeneği mevcut
- BLE mesaj geçmişi otomatik olarak temizlenir (24 saat)

## Güvenlik

- Tüm veriler cihazda şifrelenerek saklanır
- Ağ bağlantısı olmadan çalışır
- Kaynak kodu açık (güvenlik şeffaflığı)
- Üçüncü taraf izleme yok

## İletişim

Gizlilik ile ilgili sorularınız için: [İletişim bilgileri]

**Son güncelleme**: [Tarih]
