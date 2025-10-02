# AfetNet - Offline-First Disaster Response App

AfetNet is a React Native app designed for offline-first disaster communication in Istanbul. It enables peer-to-peer communication via Bluetooth and Wi-Fi when internet connectivity is unavailable during emergencies.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AfetNet App Architecture                 │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (React Native)                                   │
│  ├── Home Screen (Help Request, Status, Map)              │
│  ├── Map Screen (Offline Istanbul MBTiles)                │
│  ├── Community Screen (Resources, Volunteers)             │
│  ├── Family Screen (Contacts, Status Sharing)             │
│  ├── Guide Screen (Offline Markdown Guides)               │
│  └── Settings Screen (Permissions, SMS Backup)            │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                             │
│  ├── WatermelonDB (SQLite) - Local Data Storage           │
│  ├── BLE Mesh Manager - P2P Communication                 │
│  ├── Message Queue - Store & Forward with TTL/Dedup       │
│  ├── Triage Service - Priority Scoring                    │
│  ├── SMS Encoder - Compact Base32 Fallback                │
│  └── MBTiles Loader - Offline Map Tiles                   │
├─────────────────────────────────────────────────────────────┤
│  Data Models                                               │
│  ├── HelpRequest (Emergency Calls)                        │
│  ├── StatusPing (Safety Updates)                          │
│  ├── ResourcePost (Supply Offers)                         │
│  ├── Shelter (Safe Locations)                             │
│  └── DevicePeer (P2P Network)                             │
├─────────────────────────────────────────────────────────────┤
│  Message Format (CBOR)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ {t,id,ts,loc,prio,flags,ppl,note?,batt?,ttl,sig}  │   │
│  │ ≤200 bytes, TweetNaCl signed, TTL routing          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📱 Features

### Core Functionality
- **Offline-First**: Works without internet connectivity
- **P2P Communication**: Bluetooth mesh networking between devices
- **Emergency Help Requests**: Quick help request with location and status
- **Status Updates**: "I'm safe" notifications to family/friends
- **Resource Sharing**: Community resource availability posts
- **Offline Maps**: Istanbul MBTiles for navigation and shelter locations

### Technical Features
- **Message Queue**: Store-and-forward with TTL and deduplication
- **Triage System**: Priority scoring based on urgency factors
- **SMS Fallback**: Compact Base32 encoding for SMS when P2P fails
- **Background Services**: iOS Background Modes, Android Foreground Service
- **Privacy-First**: Local encryption, minimal data collection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator
- Xcode (for iOS development)
- Android Studio (for Android development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd AfetNet

# Install dependencies
yarn install

# iOS setup
cd ios && pod install && cd ..

# Start development server
yarn dev
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run specific test file
yarn test crypto.test.ts
```

## 📋 Message Schema

### CBOR Message Format (≤200 bytes)

```typescript
{
  t: number;        // Type: 0=help_request, 1=status_ping, 2=resource_post
  id: string;       // Unique message ID (8 chars)
  ts: number;       // Timestamp (milliseconds)
  loc: {            // Location
    lat: number;    // Latitude (4 decimal places)
    lon: number;    // Longitude (4 decimal places)
    acc: number;    // Accuracy (10m units)
  };
  prio: number;     // Priority: 0=normal, 1=high, 2=critical
  flags: {          // Status flags
    underRubble: boolean;
    injured: boolean;
    anonymity: boolean;
  };
  ppl: number;      // People count (1-100)
  note?: string;    // Optional note (max 100 chars)
  batt?: number;    // Battery level (0-100)
  ttl: number;      // Time to live (hops)
  sig: string;      // TweetNaCl signature (base64)
}
```

### SMS Fallback Format

```
AFETNET:<base32_encoded_message>
```

## 🔒 Threat Model

### Assumptions
- **Trusted Environment**: App runs on user's personal device
- **Local Storage**: SQLite database is device-encrypted
- **P2P Network**: Adversarial devices may be present
- **SMS Channel**: SMS is unencrypted but authenticated via signature

### Security Measures
- **Message Signing**: All messages signed with TweetNaCl (ed25519)
- **TTL Routing**: Messages expire after configurable hops/time
- **Deduplication**: LRU cache + Bloom filter prevent replay attacks
- **Privacy**: Optional anonymity mode, local data encryption
- **Input Validation**: Zod schemas validate all message data

### Attack Vectors & Mitigations
- **Message Replay**: Prevented by deduplication system
- **Fake Messages**: Mitigated by cryptographic signatures
- **Privacy Leaks**: Optional anonymity, local storage encryption
- **Resource Exhaustion**: TTL limits, queue size limits
- **Location Spoofing**: Accuracy metadata, signature verification

## 🗺️ Offline Maps Setup

### MBTiles Integration

1. **Download Istanbul MBTiles**:
   ```bash
   # Place istanbul.mbtiles in src/assets/mbtiles/
   # File should be ~50-100MB for Istanbul coverage
   ```

2. **MapLibre GL Configuration**:
   ```typescript
   const style = {
     version: 8,
     sources: {
       'istanbul-tiles': {
         type: 'raster',
         tiles: [`file://${mbtilesPath}`],
         tileSize: 256,
       },
     },
     layers: [
       {
         id: 'istanbul-tiles',
         type: 'raster',
         source: 'istanbul-tiles',
         minzoom: 8,
         maxzoom: 18,
       },
     ],
   };
   ```

### Map Features
- **Heatmap Layer**: Help request density visualization
- **POI Markers**: Shelters, hospitals, resource locations
- **Filter Chips**: Show/hide different data types
- **Offline Routing**: Basic navigation to nearest shelter

## 🧪 Testing

### Test Coverage
- **Crypto Tests**: Message signing/verification, CBOR encoding
- **Queue Tests**: TTL expiration, deduplication, priority ordering
- **Triage Tests**: Priority scoring, escalation logic
- **SMS Tests**: Encoding/decoding, length limits
- **Integration Tests**: End-to-end message flow

### Running Tests
```bash
# Unit tests
yarn test

# E2E tests (requires device/emulator)
yarn test:e2e

# Coverage report
yarn test:coverage
```

## 📱 Platform-Specific Setup

### iOS Configuration

**Info.plist Permissions**:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Bu uygulama yardım çağrılarını konumunuzla göndermek için konum erişimine ihtiyaç duyar.</string>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>Bu uygulama acil durumlarda yakındaki cihazlarla iletişim kurmak için Bluetooth erişimine ihtiyaç duyar.</string>
```

**Background Modes**:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
  <string>processing</string>
</array>
```

### Android Configuration

**AndroidManifest.xml Permissions**:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

**Foreground Service**:
```java
public class AfetnetForegroundService extends Service {
  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    Notification notification = new NotificationCompat.Builder(this, "afetnet")
      .setContentTitle("AfetNet")
      .setContentText("Yakın cihazlarla afet ağı çalışıyor")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .build();
    
    startForeground(1011, notification);
    return START_STICKY;
  }
}
```

## 🔧 Development

### Scripts
```bash
yarn setup          # Initial project setup
yarn dev            # Start iOS development
yarn dev:android    # Start Android development
yarn test           # Run tests
yarn lint           # Run ESLint
yarn typecheck      # Run TypeScript compiler
yarn format         # Format code with Prettier
```

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: React Native + TypeScript rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality gates

### Folder Structure
```
src/
├── app/                 # React Native app layer
│   ├── components/      # Reusable UI components
│   ├── screens/         # App screens
│   ├── hooks/           # Custom React hooks
│   └── i18n/           # Internationalization
├── core/                # Core business logic
│   ├── data/           # Database models & repositories
│   ├── p2p/            # P2P communication
│   ├── crypto/         # Cryptography utilities
│   ├── logic/          # Business logic (triage, SMS)
│   ├── offline/        # Offline features (maps, guides)
│   └── utils/          # Utility functions
└── __tests__/          # Test files
```

## 🚨 Early Warning System (EEW)

AfetNet includes an experimental Early Warning System (EEW) that provides device-side earthquake detection using accelerometer data and crowd-sourced validation through P2P mesh networking.

**⚠️ Important**: This is an experimental system and should not be relied upon as the primary source of earthquake warnings. Always follow official warnings from AFAD, Kandilli, and other authoritative sources.

### Key Features:
- **Device-side detection** using STA/LTA algorithm on accelerometer data
- **Crowd confirmation** requiring quorum of K devices within radius and time window
- **Official feed integration** for high-confidence alerts
- **False positive controls** with cooldowns and filtering
- **Critical alert UI** with full-screen modal, audible alarm, and safety instructions
- **Comprehensive testing** with test alarms and alerts

### Configuration:
- Detection parameters (STA/LTA windows, thresholds, sensitivity)
- Quorum settings (minimum devices, radius, time window)
- Filter settings (require quorum/official, cooldowns, silent prep)
- Alarm settings (volume, duration, repeat, silent mode respect)

### Usage:
1. Go to Settings → Early Warning Settings
2. Toggle "Enable Early Warning"
3. Configure detection parameters as needed
4. Test the system using "Test Alarm" and "Test Alert" buttons

See `README-EEW.md` for detailed documentation.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the test files for usage examples

---

**⚠️ Important**: This is a disaster response app. Always follow official emergency procedures and contact local authorities (112 in Turkey) for real emergencies.