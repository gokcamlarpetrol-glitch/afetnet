# AfetNet Offline Emergency App - Technical Notes

## Overview
AfetNet is a production-grade offline emergency application designed for disaster scenarios where traditional communication infrastructure may be compromised. The app provides offline mapping, BLE mesh networking, pedestrian dead-reckoning (PDR), and encrypted peer-to-peer messaging.

## Core Features

### 1. Offline Mapping & Tile Caching
- **Tile Source**: OpenStreetMap tiles cached locally
- **Cache Management**: Automatic prefetching with configurable radius (default: 2km)
- **Storage**: Uses Expo FileSystem for persistent tile storage
- **Fallback**: Remote tiles overlay when online

### 2. BLE Mesh Networking
- **Protocol**: Bluetooth Low Energy advertising and scanning
- **Message Relay**: Store-and-forward with TTL (Time To Live)
- **Range**: ~10-20m in ideal conditions, reduced in rubble/obstacles
- **Encryption**: TweetNaCl box encryption for paired devices

### 3. Pedestrian Dead-Reckoning (PDR)
- **Sensors**: Accelerometer + Magnetometer fusion
- **Step Detection**: Acceleration magnitude threshold
- **GPS Fusion**: Complementary filter combining PDR + GPS
- **Trail Tracking**: Real-time path visualization

### 4. Compass Navigation
- **Magnetometer**: Real-time heading calculation
- **Target Bearing**: Haversine distance and bearing calculations
- **Visual Arrow**: Rotating compass arrow with direction text

## Platform Limitations & Considerations

### iOS Background Restrictions
- **Advertising Limits**: iOS restricts background BLE advertising to 30 seconds
- **Scanning Limits**: Background scanning limited to 10 seconds
- **Cooldown Period**: 5-minute cooldown between background cycles
- **Recommendation**: Use foreground mode for continuous operation

### Android Differences
- **Better Background Support**: More flexible background BLE operations
- **Location Permissions**: Requires precise location for BLE scanning
- **Battery Optimization**: May need whitelist exemption

### BLE Technical Limits
- **MTU Size**: 20-244 bytes depending on device/OS
- **Advertisement Payload**: iOS: 28 bytes, Android: 31 bytes
- **Connection Limit**: iOS: 7-8 concurrent connections
- **Range Variability**: RSSI unreliable in rubble, metal structures

## Security Implementation

### Encryption
- **Library**: TweetNaCl (JavaScript-only, fast, secure)
- **Key Exchange**: QR code pairing with public key sharing
- **Message Encryption**: NaCl box encryption for paired devices
- **Group Keys**: Symmetric keys for family groups

### Message Schema
```typescript
interface BleMessage {
  id: string;           // Unique message ID
  fromPub: string;      // Sender's public key (base64)
  timestamp: number;    // Unix timestamp
  type: 'SOS' | 'MSG' | 'PING';
  lat?: number;         // Latitude if location-based
  lon?: number;         // Longitude if location-based
  rssi?: number;        // Signal strength
  ttl: number;          // Time to live (hop count)
  payload?: string;     // Encrypted payload (base64)
  signature?: string;   // Message signature (base64)
}
```

## PDR Algorithm Details

### Step Detection
- **Threshold**: Configurable acceleration magnitude (default: 0.3g)
- **Step Length**: User-configurable (default: 70cm)
- **Heading**: Magnetometer-based with device orientation compensation

### GPS Fusion
- **Filter**: Simple complementary filter: `position = α * PDR + (1-α) * GPS`
- **Alpha Adjustment**: Higher α when GPS accuracy is poor (>10m)
- **Production Note**: Consider Kalman filter for better noise reduction

## Testing Scenarios

### Manual Test Cases
1. **Device Pairing**: QR code exchange between two devices
2. **Encrypted Messaging**: Send/receive encrypted messages
3. **SOS Relay**: Send SOS from Device A, receive on Device B (offline)
4. **Multi-hop Relay**: Device C relays SOS to Device D (outside direct range)
5. **Compass Navigation**: Verify arrow points to target when rotating device
6. **PDR Tracking**: Simulate GPS loss, verify PDR maintains position estimate

### Edge Cases
- **False Positives**: RSSI triangulation noise in rubble
- **Battery Drain**: Continuous BLE advertising/scanning
- **Message Loops**: TTL prevents infinite message forwarding
- **Device Restart**: Persistence survives app restarts

## Production Considerations

### Native Modules
- **Background Modes**: iOS requires specific entitlements for background BLE
- **App Store Review**: Background BLE usage needs clear justification
- **Permissions**: Location, Bluetooth, Camera (for QR scanning)

### Battery Optimization
- **Adaptive Scanning**: Reduce scan frequency based on activity
- **Power Management**: Pause PDR when stationary
- **Background Limits**: Respect OS background execution limits

### Human-in-the-Loop
- **SOS Confirmation**: Require user confirmation before broadcasting
- **Message Validation**: Manual verification of critical messages
- **Panic Check**: Prevent accidental large data broadcasts

## Development Commands

### Installation
```bash
rm -rf node_modules
npm install --legacy-peer-deps
npx expo start -c
```

### Testing Requirements
- **Physical Devices**: Simulator cannot fully emulate BLE
- **Bluetooth Enabled**: Mac/iOS Simulator requires host Bluetooth
- **Location Services**: Enable for testing GPS and PDR
- **Multiple Devices**: Test mesh networking with 2+ devices

## Complementary to Rescue Teams

AfetNet is designed as a **complementary** tool for rescue operations, not a replacement for professional emergency services. Key considerations:

- **Limited Range**: BLE mesh limited to ~50m effective range
- **Battery Dependent**: Requires charged devices
- **Training Required**: Users need basic app familiarity
- **False Positives**: May generate false alarms in dense environments

## Future Enhancements

### Production Readiness
- **Kalman Filter**: Replace simple complementary filter in PDR
- **Background Services**: Native background BLE management
- **Mesh Protocols**: Implement proper mesh networking protocols
- **Audio Alerts**: Haptic and audio feedback for SOS signals

### Advanced Features
- **RSSI Triangulation**: Multi-device position estimation
- **Voice Notes**: Compressed audio message relay
- **Photo Sharing**: Low-resolution image relay
- **Offline Maps**: Additional tile sources and formats

---

**Note**: This system is designed for emergency scenarios where traditional communication is unavailable. Regular testing and user training are essential for effective deployment.
