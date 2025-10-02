# AfetNet Build & Release Guide

This document explains how to build and release AfetNet for production.

## Environment Variables

AfetNet uses environment variables for configuration. Create a `.env` file in the project root:

```bash
# Backend Configuration
EXPO_PUBLIC_BACKEND_URL=https://api.afetnet.org
EXPO_PUBLIC_BACKEND_WS_URL=wss://api.afetnet.org/ws

# Remote Config
EXPO_PUBLIC_REMOTE_CONFIG_URL=https://config.afetnet.org/config.json
EXPO_PUBLIC_REMOTE_CONFIG_PUBLIC_KEY=your-ed25519-public-key

# EEW Feeds
EXPO_PUBLIC_EEW_FEED_URLS=https://eew.afetnet.org/feed1.json,https://eew.afetnet.org/feed2.json

# Push Notifications
EXPO_PUBLIC_FCM_SENDER_ID=your-fcm-sender-id
EXPO_PUBLIC_APNS_BUNDLE_ID=org.afetnet.app

# SMS Gateway
EXPO_PUBLIC_SMS_GATEWAY_URL=https://api.smsgateway.com/send
EXPO_PUBLIC_SMS_GATEWAY_API_KEY=your-sms-gateway-api-key

# Map Tiles
EXPO_PUBLIC_TILES_UPDATE_URL=https://tiles.afetnet.org/istanbul

# Telemetry
EXPO_PUBLIC_TELEMETRY_ENDPOINT=https://telemetry.afetnet.org/collect

# Development
EXPO_PUBLIC_DEBUG=false
EXPO_PUBLIC_LOG_LEVEL=info
```

## EAS Secrets

Configure secrets in EAS for production builds:

```bash
# Configure EAS secrets
eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "https://api.afetnet.org"
eas secret:create --scope project --name EXPO_PUBLIC_REMOTE_CONFIG_URL --value "https://config.afetnet.org/config.json"
eas secret:create --scope project --name EXPO_PUBLIC_EEW_FEED_URLS --value "https://eew.afetnet.org/feed1.json,https://eew.afetnet.org/feed2.json"
eas secret:create --scope project --name EXPO_PUBLIC_FCM_SENDER_ID --value "your-fcm-sender-id"
eas secret:create --scope project --name EXPO_PUBLIC_SMS_GATEWAY_API_KEY --value "your-sms-gateway-api-key"
eas secret:create --scope project --name EXPO_PUBLIC_TELEMETRY_ENDPOINT --value "https://telemetry.afetnet.org/collect"
```

## iOS Release

### 1. Apple Developer Account Setup

- Ensure you have an active Apple Developer account
- Configure EAS with your Apple credentials:

```bash
eas credentials
```

### 2. Build iOS Production

```bash
# Build for iOS production
yarn build:ios

# Or manually with EAS
eas build --platform ios --profile ios:production
```

### 3. Submit to App Store

```bash
# Submit to App Store
yarn submit:ios

# Or manually with EAS
eas submit --platform ios --profile ios:production
```

## Android Release

### 1. Google Play Console Setup

- Ensure you have a Google Play Console account
- Configure EAS with your Android credentials:

```bash
eas credentials
```

### 2. Build Android Production

```bash
# Build for Android production
yarn build:android

# Or manually with EAS
eas build --platform android --profile android:production
```

### 3. Submit to Google Play

```bash
# Submit to Google Play
yarn submit:android

# Or manually with EAS
eas submit --platform android --profile android:production
```

## Backend Deployment

### 1. Local Development

```bash
# Start backend services
yarn backend:up

# Run migrations
yarn backend:migrate

# Start development server
yarn console:dev
```

### 2. Production Deployment

```bash
# Build and deploy backend
cd backend
docker-compose -f docker-compose.prod.yml up -d
```

## Testing

### 1. Run Tests

```bash
# Run all tests
yarn test

# Run store readiness tests
yarn test:store-readiness

# Run tests in watch mode
yarn test:watch
```

### 2. Generate Screenshots

```bash
# Generate store screenshots
yarn screenshots
```

### 3. Generate Icons

```bash
# Generate app icons
yarn icons
```

## Release Process

### 1. Pre-Release Checklist

- [ ] All tests passing
- [ ] Screenshots generated
- [ ] Icons generated
- [ ] Store metadata updated
- [ ] Legal documents updated
- [ ] Environment variables configured
- [ ] EAS secrets set

### 2. Release Steps

1. **Update version** in `package.json` and `app.config.js`
2. **Create release tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. **Build production**:
   ```bash
   yarn build:ios
   yarn build:android
   ```
4. **Submit to stores**:
   ```bash
   yarn submit:ios
   yarn submit:android
   ```

### 3. Post-Release

- [ ] Monitor app store reviews
- [ ] Check crash reports
- [ ] Update documentation
- [ ] Plan next release

## Troubleshooting

### Common Issues

1. **Build failures**: Check EAS secrets and environment variables
2. **Submission failures**: Verify app store credentials
3. **Backend connection**: Check network configuration and firewall settings

### Support

For build issues, check:
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)

## Security Notes

- Never commit `.env` files to version control
- Use EAS secrets for production builds
- Rotate API keys regularly
- Monitor for security vulnerabilities
- Keep dependencies updated