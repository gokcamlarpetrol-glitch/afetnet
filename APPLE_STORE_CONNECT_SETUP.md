# 🍎 APPLE STORE CONNECT - IAP KURULUM REHBERİ

## 📋 **ÖNEMLİ: Bu adımları Apple Store Connect'te yapmanız gerekiyor!**

### 1️⃣ **APP STORE CONNECT'E GİRİŞ**

1. https://appstoreconnect.apple.com adresine gidin
2. Apple Developer hesabınızla giriş yapın
3. "My Apps" bölümüne gidin
4. AfetNet uygulamanızı seçin (veya oluşturun)

---

### 2️⃣ **IN-APP PURCHASE ÜRÜNLERİ OLUŞTURMA**

#### **A) Monthly Premium (Aylık)**
1. **Features** > **In-App Purchases** > **+** butonuna tıklayın
2. **Auto-Renewable Subscription** seçin
3. **Subscription Group**: "Premium" (yeni oluşturun)
4. **Product ID**: `afetnet_premium_monthly`
5. **Reference Name**: "AfetNet Premium - Aylık"
6. **Subscription Duration**: 1 month
7. **Price**: ₺49.99 (veya uygun fiyat)
8. **Display Name**: "AfetNet Premium Aylık"
9. **Description**: "Tüm premium özellikler 1 ay boyunca"
10. **Review Information**: Gerekli bilgileri doldurun
11. **Save** butonuna tıklayın

#### **B) Yearly Premium (Yıllık)**
1. **Features** > **In-App Purchases** > **+** butonuna tıklayın
2. **Auto-Renewable Subscription** seçin
3. **Subscription Group**: "Premium" (yukarıda oluşturduğunuz)
4. **Product ID**: `afetnet_premium_yearly`
5. **Reference Name**: "AfetNet Premium - Yıllık"
6. **Subscription Duration**: 1 year
7. **Price**: ₺499.99 (veya uygun fiyat)
8. **Display Name**: "AfetNet Premium Yıllık"
9. **Description**: "Tüm premium özellikler 1 yıl boyunca (%17 indirim)"
10. **Review Information**: Gerekli bilgileri doldurun
11. **Save** butonuna tıklayın

#### **C) Lifetime Premium (Yaşam Boyu)**
1. **Features** > **In-App Purchases** > **+** butonuna tıklayın
2. **Non-Consumable** seçin (Tek seferlik satın alma)
3. **Product ID**: `afetnet_premium_lifetime`
4. **Reference Name**: "AfetNet Premium - Yaşam Boyu"
5. **Price**: ₺999.99 (veya uygun fiyat)
6. **Display Name**: "AfetNet Premium Yaşam Boyu"
7. **Description**: "Tüm premium özellikler kalıcı olarak (%50 indirim)"
8. **Review Information**: Gerekli bilgileri doldurun
9. **Save** butonuna tıklayın

---

### 3️⃣ **SUBSCRIPTION GROUP AYARLARI**

1. **Features** > **Subscription Groups** > "Premium" grubunu seçin
2. **Subscription Group Display Name**: "AfetNet Premium"
3. **Reference Name**: "Premium"
4. **Save** butonuna tıklayın

---

### 4️⃣ **PRICING & AVAILABILITY**

Her ürün için:
1. Ürünü seçin
2. **Pricing and Availability** bölümüne gidin
3. **Price Schedule**: Başlangıç fiyatını ayarlayın
4. **Availability**: Tüm ülkelerde satışa sunun
5. **Save** butonuna tıklayın

---

### 5️⃣ **SUBSCRIPTION TERMS**

1. **Features** > **Subscription Groups** > "Premium" > **Terms**
2. **Free Trial**: İsterseniz ücretsiz deneme ekleyin
3. **Introductory Price**: İsterseniz tanıtım fiyatı ekleyin
4. **Localizations**: Türkçe açıklamalar ekleyin
5. **Save** butonuna tıklayın

---

### 6️⃣ **APP STORE INFORMATION**

1. **App Information** > **App Privacy**
2. **Data Types**: "Purchases" işaretleyin
3. **Purpose**: "App Functionality" seçin
4. **Save** butonuna tıklayın

---

### 7️⃣ **TESTING (SANDBOX)**

#### **Sandbox Tester Oluşturma:**
1. **Users and Access** > **Sandbox Testers** > **+** butonuna tıklayın
2. **Email**: Test email adresi
3. **Password**: Test şifresi
4. **First Name**: Test
5. **Last Name**: User
6. **Country/Region**: Turkey
7. **Save** butonuna tıklayın

#### **Test Cihazında Test:**
1. iPhone/iPad'de **Settings** > **App Store** > **Sandbox Account**
2. Sandbox test hesabıyla giriş yapın
3. Uygulamayı açın ve satın alma yapın
4. Test satın alımı gerçekleşir (para çekilmez)

---

### 8️⃣ **APP STORE REVIEW INFORMATION**

1. **App Information** > **App Review Information**
2. **Demo Account**: Sandbox test hesabı bilgileri
3. **Notes**: "IAP test için sandbox hesabı kullanın"
4. **Contact Information**: İletişim bilgileriniz
5. **Save** butonuna tıklayın

---

### 9️⃣ **PRIVACY POLICY**

1. **App Information** > **Privacy Policy URL**
2. Premium özellikler için gizlilik politikası URL'si ekleyin
3. **Save** butonuna tıklayın

---

### 🔟 **SUBMIT FOR REVIEW**

1. **App Store** > **Prepare for Submission**
2. **In-App Purchases**: Tüm ürünlerin "Ready to Submit" olduğundan emin olun
3. **Submit for Review** butonuna tıklayın
4. Apple'ın onayını bekleyin (1-3 gün)

---

## ⚠️ **ÖNEMLİ NOTLAR**

### **Product ID'ler Kesinlikle Eşleşmeli:**
```
Uygulama: afetnet_premium_monthly
Apple Store: afetnet_premium_monthly ✅

Uygulama: afetnet_premium_yearly
Apple Store: afetnet_premium_yearly ✅

Uygulama: afetnet_premium_lifetime
Apple Store: afetnet_premium_lifetime ✅
```

### **Fiyatlar:**
- Uygulama içindeki fiyatlar Apple Store Connect'teki fiyatlarla eşleşmeli
- Apple %30 komisyon alır, net gelirinizi hesaplayın

### **Test Aşaması:**
- Sandbox test hesabıyla test edin
- Gerçek para çekilmez
- Test satın alımları gerçek satın alım sayılmaz

### **Production:**
- Apple onayı aldıktan sonra gerçek satın alımlar başlar
- Kullanıcılar gerçek para öder
- Satış raporları App Store Connect'te görünür

---

## 🚀 **SONRAKİ ADIMLAR**

1. ✅ Apple Store Connect'te ürünleri oluştur
2. ✅ Sandbox test hesabı oluştur
3. ✅ Test cihazında test et
4. ✅ Submit for Review
5. ✅ Apple onayını bekle
6. ✅ Production'a geç

---

## 📞 **DESTEK**

Sorun yaşarsanız:
- Apple Developer Support: https://developer.apple.com/contact/
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/

---

## ✅ **KONTROL LİSTESİ**

- [ ] 3 In-App Purchase ürünü oluşturuldu
- [ ] Product ID'ler doğru
- [ ] Fiyatlar ayarlandı
- [ ] Subscription Group oluşturuldu
- [ ] Sandbox test hesabı oluşturuldu
- [ ] Test edildi
- [ ] Privacy Policy eklendi
- [ ] Submit for Review yapıldı

---

**🎯 HAZIR! Artık gerçek satın alımlar çalışacak!**


