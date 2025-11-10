# EEW Environment Configuration

This project ships with a modular Early Earthquake Warning (EEW) stack. All pieces are feature-flagged via environment variables to avoid breaking existing builds.

## Server (Render / Node)

Required only if you want server-side EEW ingestion and push dispatching.

- EEW_PROVIDER_MODE
  - Values: `poll` | `official-ws` | `multi`
  - Default: `poll`
  - `poll`: use HTTP pollers (AFAD/Kandilli/USGS/EMSC)
  - `official-ws`: use a partner/vendor WS (requires URL/token)
  - `multi`: run both

- OFFICIAL_WSS_URL
  - WebSocket endpoint provided by the official vendor (optional)

- OFFICIAL_WSS_TOKEN
  - Bearer token or API key for the vendor WS (optional)

- AFAD_KANDILLI_URL
  - JSON feed for AFAD/Kandilli recent events (optional)

- USGS_URL
  - USGS FDSN API URL (optional), e.g.
  - `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=200`

- EMSC_URL
  - EMSC feed URL (optional)

Health and test endpoints:
- GET `/api/eew/health` → `{ ok: boolean }`
- POST `/api/eew/test` → dry-run echo for payload validation

## Mobile (Expo/React Native)

- EEW_ENABLED
  - Values: `true` | `false`
  - Default: `false`
  - When `true`, the app enables EEW polling and UI (countdown modal) using REST feeds.

Notes:
- Critical Alerts on iOS require Apple entitlement; currently we use time-sensitive style with sound.
- Push payload schema (from server):
```
{ type:"EEW", eventId, lat, lon, magnitude, depthKm, source, issuedAt, etaSec, region, certainty }
```

Safe defaults ensure existing builds remain unchanged when these variables are not set.

## Native Alarm (Optional - Bare/Dev Client)

Enable only if you add native deps (@notifee/react-native, @react-native-firebase/messaging) and required Android/iOS permissions.

- EEW_NATIVE_ALARM
  - Values: `true` | `false`
  - Default: `false`
  - When `true`, the app attempts to initialize Notifee + Firebase Messaging via lazy requires. If dependencies are missing, it safely no-ops.

Android:
- Create channel `eew-alerts` (already handled by code) and add custom sound in `res/raw` if desired.
- Ensure POST_NOTIFICATIONS, WAKE_LOCK, USE_FULL_SCREEN_INTENT permissions.

iOS:
- Use timeSensitive interruption level by default. For Critical Alerts, request entitlement and then enable.
