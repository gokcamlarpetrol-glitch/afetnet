# Store Assets Documentation

This document describes the automated store asset generation system for AfetNet app store listings.

## Overview

The store assets system includes:
- **Metadata Generation**: Automated creation of app store metadata in multiple languages
- **Screenshot Generation**: Automated screenshot capture using Detox E2E tests
- **Icon Rasterization**: Automated icon generation from SVG source files
- **ASO Optimization**: App Store Optimization tools and scripts

## Directory Structure

```
store/
├── metadata/
│   ├── tr/                    # Turkish metadata
│   │   ├── title.txt
│   │   ├── subtitle.txt
│   │   ├── keywords.txt
│   │   └── description.txt
│   └── en/                    # English metadata
│       ├── title.txt
│       ├── subtitle.txt
│       ├── keywords.txt
│       └── description.txt
├── screenshots/               # Generated screenshots
│   ├── phone/
│   │   ├── portrait/
│   │   └── landscape/
│   └── tablet/
│       ├── portrait/
│       └── landscape/
└── icons/                     # Generated icons
    ├── ios/
    ├── android/
    └── web/
```

## Metadata Management

### Supported Languages
- **Turkish (tr)**: Primary language for Turkish app stores
- **English (en)**: International markets

### Metadata Files
- `title.txt`: App name (30 characters max)
- `subtitle.txt`: App subtitle (30 characters max)
- `keywords.txt`: Comma-separated keywords (100 characters max)
- `description.txt`: Full app description (4000 characters max)

### Usage
```bash
# Generate metadata for all languages
yarn store:metadata

# Generate metadata for specific language
yarn store:metadata:tr
yarn store:metadata:en
```

## Screenshot Generation

### Automated Screenshot Capture
Screenshots are generated using Detox E2E tests to ensure consistency and accuracy.

### Supported Screens
- **Home Screen**: Main app interface
- **Help Request**: Emergency request flow
- **Family Circle**: Family contacts management
- **Map View**: Offline map with shelters
- **Onboarding**: First-time user experience
- **Settings**: App preferences and configuration

### Device Configurations
- **Phone**: 1080x1920, 1242x2208 (iPhone)
- **Tablet**: 1536x2048 (iPad)
- **Orientations**: Portrait and landscape

### Usage
```bash
# Generate all screenshots
yarn store:screenshots

# Generate specific screen
yarn store:screenshots:home

# Clean screenshots
yarn store:screenshots:clean

# Validate screenshots
yarn store:screenshots:validate
```

### Screenshot Scripts
```bash
# Full screenshot generation
ts-node scripts/screenshots.ts all

# Individual operations
ts-node scripts/screenshots.ts generate
ts-node scripts/screenshots.ts clean
ts-node scripts/screenshots.ts validate
ts-node scripts/screenshots.ts listing
```

## Icon Generation

### Source Files
- **SVG Source**: `./assets/icons/appicon.svg`
- **Generated Icons**: `./assets/icons/generated/`

### Supported Platforms
- **iOS**: All required sizes for iPhone and iPad
- **Android**: All density variants (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- **Web**: Favicons and PWA icons

### Icon Sizes
#### iOS
- 20x20 (@2x, @3x)
- 29x29 (@2x, @3x)
- 40x40 (@2x, @3x)
- 60x60 (@2x, @3x)
- 76x76 (@2x)
- 83.5x83.5 (@2x)
- 1024x1024 (App Store)

#### Android
- 48x48 (mdpi)
- 72x72 (hdpi)
- 96x96 (xhdpi)
- 144x144 (xxhdpi)
- 192x192 (xxxhdpi)

#### Web
- 16x16, 32x32 (favicon)
- 48x48, 180x180 (touch icons)
- 192x192, 512x512 (PWA icons)

### Usage
```bash
# Generate all icons
yarn store:icons

# Generate specific platform
yarn store:icons:ios
yarn store:icons:android
yarn store:icons:web

# Clean generated icons
yarn store:icons:clean

# Copy to project
yarn store:icons:copy
```

### Icon Scripts
```bash
# Full icon generation
ts-node scripts/rasterize-icons.ts all

# Individual operations
ts-node scripts/rasterize-icons.ts generate
ts-node scripts/rasterize-icons.ts clean
ts-node scripts/rasterize-icons.ts validate
ts-node scripts/rasterize-icons.ts copy
```

## ASO (App Store Optimization)

### Keyword Optimization
- **Primary Keywords**: afet, acil durum, deprem, sel, yangın
- **Secondary Keywords**: arama kurtarma, çevrimdışı, bluetooth, güvenlik
- **Brand Keywords**: AFAD, Kızılay

### Title Optimization
- **Turkish**: "AfetNet - Afet Ağı" (19 characters)
- **English**: "AfetNet - Disaster Network" (25 characters)

### Subtitle Optimization
- **Turkish**: "Acil durumlarda çevrimdışı iletişim" (30 characters)
- **English**: "Offline communication in emergencies" (30 characters)

### Description Structure
1. **Hook**: Problem statement
2. **Features**: Key benefits with emojis
3. **Use Cases**: Specific scenarios
4. **Security**: Privacy and safety features
5. **Call to Action**: Download encouragement

## Automation Scripts

### Package.json Scripts
```json
{
  "scripts": {
    "store:metadata": "ts-node scripts/store-metadata.ts",
    "store:screenshots": "ts-node scripts/screenshots.ts all",
    "store:icons": "ts-node scripts/rasterize-icons.ts all",
    "store:all": "yarn store:metadata && yarn store:screenshots && yarn store:icons"
  }
}
```

### CI/CD Integration
Store assets are automatically generated during the build process:

```yaml
# .github/workflows/store-assets.yml
- name: Generate Store Assets
  run: |
    yarn store:all
    yarn store:validate
```

## Quality Assurance

### Validation Checks
- **Metadata**: Character limits and formatting
- **Screenshots**: File size and dimensions
- **Icons**: All required sizes and formats
- **Consistency**: Cross-platform alignment

### Testing
```bash
# Validate all store assets
yarn store:validate

# Test metadata
yarn store:test:metadata

# Test screenshots
yarn store:test:screenshots

# Test icons
yarn store:test:icons
```

## Localization

### Adding New Languages
1. Create language directory: `store/metadata/{locale}/`
2. Add translation files: `title.txt`, `subtitle.txt`, `keywords.txt`, `description.txt`
3. Update scripts to include new locale
4. Test with `yarn store:metadata:{locale}`

### Translation Guidelines
- **Titles**: Keep under 30 characters
- **Subtitles**: Focus on key benefit
- **Keywords**: Use local search terms
- **Descriptions**: Adapt cultural context

## Performance

### Generation Time
- **Metadata**: ~1 second
- **Screenshots**: ~5-10 minutes (depends on emulator)
- **Icons**: ~30 seconds
- **Total**: ~6-11 minutes

### File Sizes
- **Screenshots**: ~2-5MB each
- **Icons**: ~1-50KB each
- **Total Package**: ~50-100MB

## Troubleshooting

### Common Issues

1. **Screenshots Not Generating**
   - Check Android emulator is running
   - Verify Detox configuration
   - Ensure test files exist

2. **Icons Not Generating**
   - Check ImageMagick installation
   - Verify SVG source file exists
   - Check file permissions

3. **Metadata Validation Fails**
   - Check character limits
   - Verify file encoding (UTF-8)
   - Check for special characters

### Debug Commands
```bash
# Debug screenshots
detox test --configuration android.emu.debug --grep "screenshot"

# Debug icons
convert -list format | grep PNG

# Debug metadata
yarn store:validate:metadata
```

## Best Practices

### Screenshots
- Use consistent device configurations
- Capture key user flows
- Include both portrait and landscape
- Test on different screen sizes

### Icons
- Use vector source (SVG)
- Maintain consistent branding
- Test on different backgrounds
- Ensure readability at small sizes

### Metadata
- A/B test different titles
- Optimize for local search terms
- Keep descriptions scannable
- Update regularly based on performance

## Monitoring

### Store Performance
- Track download conversion rates
- Monitor keyword rankings
- Analyze user reviews
- Update assets based on feedback

### Automation Health
- Monitor generation success rates
- Track asset file sizes
- Validate cross-platform consistency
- Update scripts based on store changes
