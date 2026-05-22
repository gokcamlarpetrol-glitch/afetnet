# AfetNet — KVKK Aydınlatma Metni (TASLAK)

> **DURUM: TASLAK — hukuki onay gereklidir.**
> Bu metin KVKK md.10 (Aydınlatma Yükümlülüğü) kapsamında hazırlanmış bir
> taslaktır. Yayınlanmadan önce **bir hukuk danışmanı tarafından gözden
> geçirilmeli**, `[KÖŞELİ PARANTEZ]` içindeki alanlar gerçek bilgilerle
> doldurulmalıdır. Onaylanınca:
> - `privacy-policy.html` içine ayrı bölüm olarak eklenir, ve/veya
> - uygulama içinde erişilebilir bir ekran/bağlantı olarak sunulur,
> - Onboarding son adımına "Aydınlatma Metni" bağlantısı eklenir.

---

## 1. Veri Sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel
verileriniz, veri sorumlusu sıfatıyla aşağıdaki kuruluş tarafından işlenmektedir:

- **Veri Sorumlusu:** [ŞİRKET/UNVAN]
- **Adres:** [AÇIK ADRES]
- **VERBİS Kayıt No:** [VERBİS NUMARASI — kayıt zorunluysa]
- **İletişim / KVKK Başvuru:** [kvkk@afetnet.app — domain tabanlı kurumsal e-posta]

> Not: Başvuru kanalı, kişiye değil kuruma ait kalıcı bir adres olmalıdır
> (KVKK Kurulu denetiminde aranır). Bireysel Gmail adresi uygun değildir.

---

## 2. İşlenen Kişisel Veriler

AfetNet, bir afet/acil durum iletişim uygulaması olarak aşağıdaki kişisel
veri kategorilerini işler:

| Kategori | Veriler | Nitelik |
|---|---|---|
| Kimlik | Ad-soyad, e-posta adresi | Genel |
| Konum | GPS konumu (ön plan ve — ilgili özellik açıkken — arka plan) | Genel |
| **Sağlık** | Kan grubu, alerjiler, kronik rahatsızlıklar, kullanılan ilaçlar | **Özel nitelikli (KVKK md.6)** |
| Cihaz | Cihaz tanımlayıcı, işletim sistemi, uygulama sürümü, FCM bildirim jetonu | Genel |
| İletişim | Mesaj içeriği ve meta verisi, sesli mesajlar, acil durum (SOS) kayıtları | Genel |
| Mesh ağı | Yakındaki AfetNet cihazlarına ait Bluetooth yayını verileri | Genel |
| İşitsel | SOS sırasında (kullanıcı ayarı açıksa) kısa ortam sesi kaydı | Genel |

---

## 3. Kişisel Verilerin İşlenme Amaçları

- Deprem erken uyarı bildirimlerinin iletilmesi,
- Acil durum (SOS) yardım çağrılarının yakın çevreye ve aile üyelerine
  iletilmesi ve koordinasyonu,
- Aile üyeleri arasında — yalnızca karşılıklı onayla — güvenlik amaçlı
  konum ve durum paylaşımı,
- İnternet erişiminin kesildiği durumlarda Bluetooth mesh ağı üzerinden
  mesaj/SOS iletimi,
- Sağlık verilerinin, yalnızca acil durumda ve yalnızca kullanıcının
  onayladığı aile üyelerine ulaştırılması,
- Uygulamanın çalışırlığının ve güvenliğinin sağlanması.

---

## 4. Verilerin Aktarıldığı Taraflar ve Amaçları

| Alıcı | Amaç | Konum |
|---|---|---|
| Google Firebase | Kimlik doğrulama, veritabanı, bildirim altyapısı | [Firestore bölgesi — `europe-west1` doğrulanmalı] |
| OpenAI (AI asistan kullanılırsa) | Yapay zekâ destekli afet/ilk yardım yanıtları | Yurt dışı — kullanıcı rızasıyla |
| Aile üyeleri | Karşılıklı onaylı konum/durum/sağlık paylaşımı | Kullanıcı cihazları |

> Yurt dışına aktarım, KVKK md.9 kapsamında **açık rıza** veya uygun
> güvencelerle (taahhütname/standart sözleşme) yapılır. AI asistan
> kullanımı için kullanıcıdan ayrıca açık rıza alınır; rıza verilmezse
> mesajlar yurt dışı sağlayıcıya iletilmez (yalnızca çevrimdışı yanıt).

---

## 5. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi

Kişisel verileriniz, uygulamayı kullanmanız sırasında — sizin girişiniz,
cihaz sensörleri ve uygulama içi etkileşimler aracılığıyla — elektronik
ortamda toplanır. Hukuki sebepler:

- **Açık rıza** (KVKK md.5/1 ve özel nitelikli sağlık verisi için md.6/2):
  sağlık verisi paylaşımı, arka plan konumu, AI asistan kullanımı.
- **Bir sözleşmenin kurulması/ifası** (md.5/2-c): hesap ve temel uygulama
  işlevleri.
- **İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla
  veri sorumlusunun meşru menfaati** (md.5/2-f): güvenlik, kötüye kullanım
  önleme.

---

## 6. Saklama Süreleri

| Veri | Saklama süresi |
|---|---|
| Konum geçmişi | 30 gün |
| Mesajlar | 1 yıl |
| SOS kayıtları | 90 gün |
| Çökme/teşhis kayıtları | 30 gün |
| Hesap/kimlik verileri | Hesap silinene kadar |

Süre sonunda veriler silinir veya anonim hâle getirilir. Hesap silindiğinde
veriler — yedeklerden makul süre içinde (en geç 30 gün) — kalıcı olarak
silinir.

---

## 7. KVKK Madde 11 — İlgili Kişinin Hakları

Veri sahibi olarak; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse
bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını
öğrenme, yurt içi/yurt dışı aktarıldığı tarafları bilme, eksik/yanlış
işlenmişse düzeltilmesini, KVKK'da öngörülen şartlarla silinmesini/yok
edilmesini isteme, düzeltme/silme işlemlerinin aktarılan taraflara
bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu
aleyhinize bir sonuç çıkmasına itiraz etme ve zarara uğramanız hâlinde
giderim talep etme haklarına sahipsiniz.

Başvurularınızı [kvkk@afetnet.app] adresine iletebilirsiniz. Uygulama
içinde **"Verilerimi İndir"** (erişim hakkı) ve **"Hesabımı Sil"** (silme
hakkı) işlevleri sunulmaktadır.

---

*AfetNet KVKK Aydınlatma Metni · TASLAK v1.6.3 · Hukuki onay sonrası yayınlanacaktır.*
