# CI/CD Pipeline Documentation

This document describes the continuous integration and deployment pipeline for AfetNet.

## Overview

The CI/CD pipeline includes:
- **E2E Testing**: Detox-based end-to-end testing on Android emulators
- **Backend Integration**: Python backend API testing with Docker services
- **Quality Gates**: Linting, type checking, and test coverage requirements

## Workflows

### 1. E2E Android Tests (`e2e-android.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main`

**Steps:**
1. **Setup Environment**
   - macOS runner with Node.js 18
   - Android SDK and Java 17
   - Gradle dependency caching

2. **Emulator Setup**
   - Creates Android Virtual Device (API 33)
   - Starts emulator with Google APIs
   - Uses Nexus 6 profile for consistent testing

3. **Test Execution**
   - Builds app in debug configuration
   - Runs Detox tests in headless mode
   - Captures screenshots on failure

4. **Artifacts**
   - Test results and coverage reports
   - Screenshots for failed tests
   - Build artifacts

**Usage:**
```bash
# Run locally (requires Android emulator)
yarn e2e:build
yarn e2e:android

# Run specific test suite
detox test --configuration android.emu.debug --grep "Home Screen"
```

### 2. Backend Integration Tests (`backend-int.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main`

**Services:**
- PostgreSQL 15 database
- Redis cache (if needed)
- Docker Compose test environment

**Steps:**
1. **Environment Setup**
   - Ubuntu runner with Python 3.11
   - Node.js 18 for frontend integration tests
   - PostgreSQL service with health checks

2. **Backend Testing**
   - Unit tests with pytest and coverage
   - Integration tests with Docker services
   - API endpoint testing
   - Database migration testing

3. **Service Testing**
   - Data retention job testing
   - Telemetry collection testing
   - Volunteer QR generation/verification
   - Damage report submission/retrieval
   - Data export functionality

4. **Frontend-Backend Integration**
   - End-to-end API testing
   - Authentication flow testing
   - Data synchronization testing

**Usage:**
```bash
# Run backend tests locally
cd backend
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ -v --cov=app --cov-report=html

# Test specific service
python app/retention_job.py --cleanup --stats
```

## Test Structure

### E2E Tests (Detox)

```
__tests__/e2e/
├── home.spec.js          # Home screen tests
├── help-request.spec.js  # Help request flow
├── family.spec.js        # Family circle tests
├── map.spec.js          # Map functionality
├── settings.spec.js     # Settings screen
└── onboarding.spec.js   # Onboarding flow
```

### Backend Tests (pytest)

```
backend/tests/
├── unit/                 # Unit tests
│   ├── test_models.py
│   ├── test_services.py
│   └── test_utils.py
├── integration/          # Integration tests
│   ├── test_database.py
│   ├── test_api.py
│   └── test_services.py
├── api/                  # API endpoint tests
│   ├── test_volunteer.py
│   ├── test_damage.py
│   └── test_export.py
└── migrations/           # Database migration tests
    └── test_migrations.py
```

## Quality Gates

### Frontend
- **Linting**: ESLint with TypeScript rules
- **Type Checking**: TypeScript strict mode
- **Testing**: Jest with React Native Testing Library
- **E2E Testing**: Detox with Android emulator
- **Coverage**: Minimum 80% code coverage

### Backend
- **Linting**: flake8 and black formatting
- **Type Checking**: mypy static analysis
- **Testing**: pytest with coverage
- **Integration**: Docker Compose services
- **Coverage**: Minimum 85% code coverage

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Android Studio with emulator
- Docker and Docker Compose

### Setup
```bash
# Install dependencies
yarn install
cd backend && pip install -r requirements.txt

# Setup database
cd backend
docker-compose up -d postgres

# Run migrations
python manage.py migrate

# Start backend services
docker-compose up -d
```

### Running Tests
```bash
# Frontend tests
yarn test
yarn test:integration
yarn e2e:android

# Backend tests
cd backend
python -m pytest tests/
python -m pytest tests/integration/

# Full CI simulation
yarn lint && yarn typecheck && yarn test
cd backend && python -m pytest tests/
```

## Configuration

### Detox Configuration
```javascript
// detox.config.js
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'android.emu.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      type: 'android.emulator',
      device: {
        avdName: 'test'
      }
    }
  }
};
```

### Backend Test Configuration
```python
# backend/tests/conftest.py
import pytest
import os

@pytest.fixture(scope='session')
def test_database():
    os.environ['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/afetnet_test'
    # Setup test database
    yield
    # Cleanup
```

## Troubleshooting

### Common Issues

1. **Android Emulator Not Starting**
   - Check AVD configuration
   - Ensure hardware acceleration is enabled
   - Verify Android SDK installation

2. **Backend Tests Failing**
   - Check PostgreSQL service health
   - Verify Docker services are running
   - Check database migrations

3. **E2E Tests Timeout**
   - Increase timeout values in Detox config
   - Check emulator performance
   - Verify app build is successful

### Debug Commands
```bash
# Check emulator status
adb devices

# View emulator logs
adb logcat

# Check Docker services
docker-compose ps

# View backend logs
docker-compose logs backend
```

## Performance Metrics

### E2E Test Performance
- **Build Time**: ~5-8 minutes
- **Test Execution**: ~10-15 minutes
- **Total Pipeline**: ~20-25 minutes

### Backend Test Performance
- **Unit Tests**: ~2-3 minutes
- **Integration Tests**: ~5-8 minutes
- **Total Pipeline**: ~10-15 minutes

## Security Considerations

- **Secrets Management**: Use GitHub Secrets for sensitive data
- **Database Access**: Test databases are isolated and ephemeral
- **API Keys**: Never commit API keys or tokens
- **Docker Images**: Use official, trusted base images

## Monitoring and Alerting

- **Test Failures**: GitHub Actions notifications
- **Coverage Drops**: Codecov integration
- **Performance Regression**: Automated performance testing
- **Security Vulnerabilities**: Dependabot alerts

## Contributing

When adding new tests:
1. Follow existing test patterns
2. Add appropriate test data
3. Include both positive and negative test cases
4. Update this documentation if needed
5. Ensure tests are deterministic and reliable
