# GitHub Repository Setup Instructions

## 1. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `afetnet`
3. Description: `Offline-first disaster response app for Istanbul with P2P mesh networking and Early Warning System`
4. Set to **Public**
5. Do NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## 2. Connect Local Repository to GitHub

After creating the repository, run these commands:

```bash
# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/afetnet.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 3. Set Up GitHub Secrets

Go to your repository settings: https://github.com/YOUR_USERNAME/afetnet/settings/secrets/actions

Add these secrets:

### Required Secrets:
- `EXPO_TOKEN` - Your Expo access token
- `APPLE_ID` - Apple Developer account email
- `APPLE_ID_PASSWORD` - Apple Developer account password
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Google Play Console service account JSON

### Optional Secrets:
- `GITHUB_TOKEN` - GitHub token for releases (usually auto-provided)

## 4. Enable GitHub Actions

1. Go to Actions tab in your repository
2. Enable workflows if prompted
3. The following workflows will be available:
   - Security Audit (weekly)
   - CodeQL Analysis (on push/PR)
   - Secret Scan (daily)
   - Dependency Review (on PR)
   - Mobile Release (on tag v*)

## 5. Create First Release

After pushing to GitHub:

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the mobile release workflow.

## 6. Store Submission

Once the release is built:

### iOS App Store:
1. Download the .ipa file from the GitHub Actions artifacts
2. Use Transporter app or Xcode to upload to App Store Connect
3. Submit for review

### Google Play Store:
1. Download the .aab file from the GitHub Actions artifacts
2. Upload to Google Play Console
3. Submit for review

## Repository Structure

Your repository will contain:

```
afetnet/
├── src/                    # Source code
├── assets/                 # App assets and icons
├── store/                  # Store metadata and assets
├── backend/                # Backend API and services
├── site/                   # Website and legal pages
├── scripts/                # Build and utility scripts
├── .github/                # GitHub Actions and policies
├── docs/                   # Documentation
└── README.md               # Main documentation
```

## Next Steps

1. Complete the GitHub repository setup
2. Add the required secrets
3. Create the first release tag
4. Monitor the GitHub Actions workflows
5. Prepare for store submission

## Support

If you encounter any issues:
1. Check the GitHub Actions logs
2. Review the README files in the repository
3. Check the security and build documentation
