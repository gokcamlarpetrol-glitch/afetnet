# Google Play Permissions Mapping for AfetNet

## Required Permissions

### Location Permissions
- `ACCESS_FINE_LOCATION` - Required for accurate location in help requests
- `ACCESS_COARSE_LOCATION` - Fallback for approximate location
- **Purpose**: Emergency help request location sharing
- **User Education**: "Konum bilginiz sadece acil durumlarda yardım taleplerinizi iletmek için kullanılır"

### Bluetooth Permissions
- `BLUETOOTH` - Required for P2P mesh network
- `BLUETOOTH_ADMIN` - Required for BLE advertising and scanning
- `ACCESS_FINE_LOCATION` - Required for BLE scanning on Android 6+
- **Purpose**: Offline P2P communication during emergencies
- **User Education**: "Bluetooth, internet olmadığında diğer cihazlarla iletişim kurmak için kullanılır"

### Notification Permissions
- `POST_NOTIFICATIONS` - Required for emergency alerts
- **Purpose**: Critical emergency notifications and EEW alerts
- **User Education**: "Acil durum uyarıları ve erken uyarı sistemi bildirimleri için gerekli"

### Storage Permissions
- `READ_EXTERNAL_STORAGE` - Required for contact import
- `WRITE_EXTERNAL_STORAGE` - Required for data export
- **Purpose**: Contact import and data export functionality
- **User Education**: "Kişi listesi içe aktarma ve veri dışa aktarma için kullanılır"

## Optional Permissions

### Camera Permission
- `CAMERA` - Required for QR code scanning
- **Purpose**: Volunteer QR verification
- **User Education**: "Gönüllü QR kod doğrulama için kullanılır"

### Contacts Permission
- `READ_CONTACTS` - Required for family contact import
- **Purpose**: Family contact management
- **User Education**: "Aile üyelerinizi hızlıca eklemek için kullanılır"

### Phone Permission
- `CALL_PHONE` - Required for emergency calls
- **Purpose**: Direct emergency call functionality
- **User Education**: "Acil durum aramaları için kullanılır"

## Background Permissions

### Background Location
- `ACCESS_BACKGROUND_LOCATION` - Required for EEW detection
- **Purpose**: Early warning system location monitoring
- **User Education**: "Erken uyarı sistemi için arka planda konum takibi gerekli"

### Background Bluetooth
- `BLUETOOTH_SCAN` - Required for background BLE scanning
- `BLUETOOTH_ADVERTISE` - Required for background BLE advertising
- **Purpose**: Continuous P2P mesh network operation
- **User Education**: "Sürekli P2P ağ iletişimi için arka planda Bluetooth gerekli"

## Permission Justification

### Why These Permissions Are Necessary

1. **Location Access**: Critical for emergency response coordination
2. **Bluetooth**: Enables offline communication when cellular networks fail
3. **Notifications**: Essential for emergency alerts and early warning system
4. **Storage**: Required for data management and contact import
5. **Background Access**: Necessary for continuous emergency monitoring

### Privacy Protection Measures

1. **Data Minimization**: Only collect data necessary for emergency response
2. **Encryption**: All data encrypted in transit and at rest
3. **Retention**: Data automatically deleted after 30 days
4. **User Control**: Users can delete all data at any time
5. **No Tracking**: No advertising or tracking functionality

## User Education Text (Turkish)

```
AfetNet acil durum ağı uygulaması, afet sırasında internet olmasa bile 
diğer cihazlarla iletişim kurmanızı sağlar. Uygulamanın düzgün çalışması 
için aşağıdaki izinlere ihtiyaç vardır:

• Konum: Yardım taleplerinizin konumunu belirlemek için
• Bluetooth: Diğer cihazlarla P2P iletişim için
• Bildirimler: Acil durum uyarıları için
• Depolama: Kişi listesi ve veri yönetimi için
• Kamera: QR kod okuma için
• Telefon: Acil durum aramaları için

Tüm verileriniz şifrelenir ve 30 gün sonra otomatik olarak silinir.
```

## User Education Text (English)

```
AfetNet emergency network app enables communication with other devices 
even when there's no internet during disasters. The app requires the 
following permissions to function properly:

• Location: To determine the location of your help requests
• Bluetooth: For P2P communication with other devices
• Notifications: For emergency alerts
• Storage: For contact list and data management
• Camera: For QR code scanning
• Phone: For emergency calls

All your data is encrypted and automatically deleted after 30 days.
```

## Compliance Notes

- All permissions are clearly justified for emergency response functionality
- No unnecessary permissions requested
- Clear user education provided for each permission
- Privacy policy clearly explains data usage
- Users can revoke permissions and delete data at any time
- App follows Google Play's data safety requirements
