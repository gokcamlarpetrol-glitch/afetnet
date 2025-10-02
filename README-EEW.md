# Early Warning System (EEW) - AfetNet

## Overview

The Early Warning System (EEW) is an experimental feature of AfetNet that provides device-side earthquake detection using accelerometer data and crowd-sourced validation through P2P mesh networking.

## ⚠️ Important Disclaimers

- **This is an experimental system** and should not be relied upon as the primary source of earthquake warnings
- **False alarms and missed warnings are possible**
- **Always follow official earthquake warnings from AFAD, Kandilli, and other authoritative sources**
- **This system is for educational and research purposes**

## How It Works

### 1. Device-Side Detection
- Uses accelerometer data at ~50Hz sampling rate
- Implements STA/LTA (Short-Term Average / Long-Term Average) algorithm
- Triggers when STA/LTA ratio exceeds threshold (default: 3.0) AND absolute acceleration > 0.08g
- Includes debouncing with configurable cooldown periods

### 2. Crowd Confirmation
- Local P-wave detections are broadcast via P2P mesh network
- System waits for quorum of K devices (default: 5) within radius (default: 8km) within time window (default: 5s)
- Only triggers alert if quorum is reached OR official feed confirms

### 3. Official Feed Integration
- Optional integration with official earthquake feeds (AFAD, USGS, etc.)
- Parses JSON feeds and calculates ETA for current location
- High-confidence alerts bypass some filtering requirements

### 4. Alert System
- Full-screen modal with critical alert UI
- Audible alarm with haptic feedback
- Clear safety instructions in Turkish/English
- Configurable volume, duration, and repeat settings

## Configuration

### Detection Parameters
- **STA Window**: Short-term average window (default: 500ms)
- **LTA Window**: Long-term average window (default: 3000ms)
- **Threshold**: STA/LTA ratio threshold (default: 3.0)
- **Minimum Acceleration**: Minimum absolute acceleration in G (default: 0.08g)
- **Update Interval**: Accelerometer sampling rate (default: 20ms for ~50Hz)

### Quorum Settings
- **K (Minimum Devices)**: Number of devices required for quorum (default: 5)
- **Radius**: Geographic radius for cluster detection (default: 8km)
- **Time Window**: Time window for quorum detection (default: 5s)

### Filter Settings
- **Require Quorum**: Whether to require peer confirmation (default: true)
- **Require Official**: Whether to require official feed confirmation (default: false)
- **Silent Prep**: Show silent preparation when only local signal (default: true)
- **Device Cooldown**: Minimum time between alerts per device (default: 60s)
- **Region Cooldown**: Minimum time between alerts per region (default: 30s)

### Alarm Settings
- **Enabled**: Whether alarms are enabled (default: true)
- **Volume**: Alarm volume 0-100% (default: 100%)
- **Duration**: How long alarm plays (default: 10s)
- **Repeat**: Whether alarm repeats (default: true)
- **Respect Silent Mode**: Whether to respect device silent mode (iOS: true, Android: false)

## Technical Implementation

### Core Components

1. **EEWDetector** (`/core/sensors/eew.ts`)
   - Accelerometer data processing
   - STA/LTA algorithm implementation
   - Detection event emission

2. **EEWManager** (`/core/logic/eew.ts`)
   - P2P quorum management
   - Cluster detection and alerting
   - Official feed integration

3. **EEWFilter** (`/core/eew/filter.ts`)
   - False positive prevention
   - Cooldown management
   - Silent preparation handling

4. **OfficialFeedManager** (`/core/eew/feeds.ts`)
   - Official feed polling and parsing
   - ETA calculation
   - Alert processing

5. **EEWAlarmManager** (`/core/audio/alarm.ts`)
   - Audio alarm management
   - Haptic feedback
   - Volume and timing control

### P2P Message Types

- **EEW_P**: P-wave detection message (type 3)
- **EEW_ACK**: Acknowledgment message (type 4)

Both use high priority and small TTL for immediate propagation.

### Alert UI

- **AlertSheet** (`/app/components/eew/AlertSheet.tsx`)
  - Full-screen blocking modal
  - Countdown timer
  - Safety instructions
  - Mute/unmute controls
  - Test mode support

## Usage

### Enabling EEW
1. Go to Settings → Early Warning Settings
2. Toggle "Enable Early Warning"
3. Configure detection parameters as needed
4. Test the system using "Test Alarm" and "Test Alert" buttons

### Testing
- **Test Alarm**: Plays the alarm sound for testing
- **Test Alert**: Shows the full alert UI in test mode
- Both help verify the system is working correctly

### Monitoring
- Check detection status in settings
- Monitor P2P message counts
- Review alert history and cooldowns

## Battery Impact

EEW detection has minimal battery impact:
- Accelerometer sampling at 50Hz
- P2P messaging only when triggered
- Efficient STA/LTA calculations
- Configurable update intervals

## Legal and Safety Notes

### What This System Is
- Experimental early warning system
- Educational and research tool
- Community-based detection network

### What This System Is NOT
- Official earthquake warning system
- Replacement for professional monitoring
- Guaranteed accurate predictions

### Safety Recommendations
1. **Always follow official warnings** from AFAD, Kandilli, and other authorities
2. **Use this system as supplementary information only**
3. **Maintain awareness** that false alarms are possible
4. **Keep official alert apps** installed and enabled
5. **Follow local emergency procedures** regardless of app alerts

## Troubleshooting

### Common Issues

1. **No alerts despite earthquakes**
   - Check if EEW is enabled in settings
   - Verify accelerometer permissions
   - Check quorum requirements (may need more nearby devices)
   - Ensure device is not in cooldown period

2. **False alarms**
   - Adjust threshold settings (increase for fewer false alarms)
   - Enable "Require Quorum" setting
   - Enable "Require Official" setting
   - Reduce sensitivity settings

3. **Battery drain**
   - Check accelerometer update interval
   - Ensure proper cooldown settings
   - Monitor P2P message frequency

4. **Alarm not playing**
   - Check alarm volume settings
   - Verify device is not in silent mode
   - Test alarm functionality
   - Check audio permissions

### Debug Information
- Detection status and parameters
- P2P message counts and peer information
- Alert history and cooldown status
- Battery level and performance metrics

## Development Notes

### Testing
- Use `simulateDetection()` for testing detection logic
- Use `simulateClusterAlert()` for testing quorum logic
- Use `simulateOfficialAlert()` for testing feed integration
- Test with various threshold and parameter combinations

### Performance
- Monitor accelerometer sampling efficiency
- Optimize STA/LTA calculations
- Minimize P2P message overhead
- Balance accuracy vs. battery usage

### Future Enhancements
- Machine learning-based detection
- Integration with more official feeds
- Advanced filtering algorithms
- Improved ETA calculations
- Better user interface and accessibility

## API Reference

### EEWDetector
```typescript
// Start detection with custom options
await startEEWDetection({
  staMs: 500,
  ltaMs: 3000,
  pThreshold: 3.0,
  minGapMs: 30000,
  minAccelG: 0.08,
  updateIntervalMs: 20
});

// Stop detection
stopEEWDetection();

// Listen for events
detector.on('eew:local_pwave', (event) => {
  console.log('P-wave detected:', event.strength);
});
```

### EEWManager
```typescript
// Update configuration
await eewManager.updateConfig({
  k: 5,
  radiusKm: 8,
  windowSec: 5
});

// Listen for alerts
eewManager.on('eew:cluster_alert', (alert) => {
  console.log('Cluster alert:', alert.deviceCount, 'devices');
});

eewManager.on('eew:official_alert', (alert) => {
  console.log('Official alert:', alert.magnitude, alert.etaSeconds);
});
```

### EEWFilter
```typescript
// Update filter settings
await eewFilter.updateConfig({
  requireQuorum: true,
  requireOfficial: false,
  deviceCooldownMs: 60000,
  regionCooldownMs: 30000,
  silentPrepEnabled: true
});

// Filter events
const result = await eewFilter.filterLocalPWave(localEvent, hasQuorum, hasOfficial);
```

## Contributing

When contributing to the EEW system:
1. Maintain strict safety standards
2. Add comprehensive tests for all new features
3. Document any changes to detection algorithms
4. Update user-facing documentation
5. Consider battery and performance implications
6. Follow the experimental nature of the system

## License

This EEW system is part of AfetNet and subject to the same licensing terms. The experimental nature means users assume all risks associated with its use.
