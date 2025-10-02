import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { ActivationWizard } from '../src/app/screens/ActivationWizard';
import { RemoteConfigManager } from '../src/core/remoteconfig/manager';
import { TilesUpdater } from '../src/core/offline/tiles-updater';
import { PushNotificationManager } from '../src/core/notify/push';
import { OfficialFeedManager } from '../src/core/eew/feeds';
import { BackendManager } from '../src/core/backend/manager';
import { TelemetryManager } from '../src/core/telemetry/manager';

// Mock the core modules
jest.mock('../src/core/remoteconfig/manager');
jest.mock('../src/core/offline/tiles-updater');
jest.mock('../src/core/notify/push');
jest.mock('../src/core/eew/feeds');
jest.mock('../src/core/backend/manager');
jest.mock('../src/core/telemetry/manager');

// Mock i18n
const mockI18n = {
  t: (key: string) => key,
  changeLanguage: jest.fn(),
  language: 'tr',
};

// Mock navigation
const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

// Mock route
const mockRoute = {
  params: {},
};

describe('ActivationWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.title')).toBeTruthy();
    expect(getByText('activation.subtitle')).toBeTruthy();
  });

  it('displays remote config section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.remote_config')).toBeTruthy();
    expect(getByText('activation.remote_config_desc')).toBeTruthy();
  });

  it('displays OTA tiles section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.ota_tiles')).toBeTruthy();
    expect(getByText('activation.ota_tiles_desc')).toBeTruthy();
  });

  it('displays push notifications section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.push_notifications')).toBeTruthy();
    expect(getByText('activation.push_notifications_desc')).toBeTruthy();
  });

  it('displays EEW feeds section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.eew_feeds')).toBeTruthy();
    expect(getByText('activation.eew_feeds_desc')).toBeTruthy();
  });

  it('displays backend section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.backend')).toBeTruthy();
    expect(getByText('activation.backend_desc')).toBeTruthy();
  });

  it('displays telemetry section', () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    expect(getByText('activation.telemetry')).toBeTruthy();
    expect(getByText('activation.telemetry_desc')).toBeTruthy();
  });

  it('handles remote config test button press', async () => {
    const mockTestRemoteConfig = jest.fn().mockResolvedValue(true);
    (RemoteConfigManager as jest.Mock).mockImplementation(() => ({
      testRemoteConfig: mockTestRemoteConfig,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.remote_config_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(mockTestRemoteConfig).toHaveBeenCalled();
    });
  });

  it('handles OTA tiles download button press', async () => {
    const mockDownloadTiles = jest.fn().mockResolvedValue(true);
    (TilesUpdater as jest.Mock).mockImplementation(() => ({
      downloadTiles: mockDownloadTiles,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const downloadButton = getByText('activation.ota_tiles_download');
    fireEvent.press(downloadButton);

    await waitFor(() => {
      expect(mockDownloadTiles).toHaveBeenCalled();
    });
  });

  it('handles push notifications test button press', async () => {
    const mockTestPush = jest.fn().mockResolvedValue(true);
    (PushNotificationManager as jest.Mock).mockImplementation(() => ({
      testPush: mockTestPush,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.push_notifications_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(mockTestPush).toHaveBeenCalled();
    });
  });

  it('handles EEW feeds test button press', async () => {
    const mockTestFeeds = jest.fn().mockResolvedValue(true);
    (OfficialFeedManager as jest.Mock).mockImplementation(() => ({
      testFeeds: mockTestFeeds,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.eew_feeds_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(mockTestFeeds).toHaveBeenCalled();
    });
  });

  it('handles backend ping test button press', async () => {
    const mockPingBackend = jest.fn().mockResolvedValue(true);
    (BackendManager as jest.Mock).mockImplementation(() => ({
      pingBackend: mockPingBackend,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const pingButton = getByText('activation.backend_ping');
    fireEvent.press(pingButton);

    await waitFor(() => {
      expect(mockPingBackend).toHaveBeenCalled();
    });
  });

  it('handles telemetry test button press', async () => {
    const mockTestTelemetry = jest.fn().mockResolvedValue(true);
    (TelemetryManager as jest.Mock).mockImplementation(() => ({
      testTelemetry: mockTestTelemetry,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.telemetry_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(mockTestTelemetry).toHaveBeenCalled();
    });
  });

  it('handles save button press', async () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const saveButton = getByText('activation.save');
    fireEvent.press(saveButton);

    // Should navigate back after saving
    await waitFor(() => {
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('handles reset button press', async () => {
    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const resetButton = getByText('activation.reset');
    fireEvent.press(resetButton);

    // Should reset all form fields
    await waitFor(() => {
      // Check if form fields are reset
      expect(getByText('activation.remote_config_url_placeholder')).toBeTruthy();
    });
  });

  it('displays loading state during operations', async () => {
    const mockTestRemoteConfig = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(true), 100))
    );
    (RemoteConfigManager as jest.Mock).mockImplementation(() => ({
      testRemoteConfig: mockTestRemoteConfig,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.remote_config_test');
    fireEvent.press(testButton);

    // Should show loading state
    await waitFor(() => {
      expect(getByText('activation.loading')).toBeTruthy();
    });
  });

  it('displays error messages on failure', async () => {
    const mockTestRemoteConfig = jest.fn().mockRejectedValue(new Error('Test error'));
    (RemoteConfigManager as jest.Mock).mockImplementation(() => ({
      testRemoteConfig: mockTestRemoteConfig,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.remote_config_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(getByText('activation.remote_config_error')).toBeTruthy();
    });
  });

  it('displays success messages on success', async () => {
    const mockTestRemoteConfig = jest.fn().mockResolvedValue(true);
    (RemoteConfigManager as jest.Mock).mockImplementation(() => ({
      testRemoteConfig: mockTestRemoteConfig,
    }));

    const { getByText } = render(
      <I18nextProvider i18n={mockI18n as any}>
        <ActivationWizard navigation={mockNavigation as any} route={mockRoute as any} />
      </I18nextProvider>
    );

    const testButton = getByText('activation.remote_config_test');
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(getByText('activation.remote_config_success')).toBeTruthy();
    });
  });
});
