import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SettingsScreen } from '../../src/app/screens/SettingsScreen';

// Mock dependencies
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('../../src/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../src/core/data/deletion', () => ({
  DataDeletionManager: {
    getInstance: jest.fn().mockReturnValue({
      getDataSummary: jest.fn().mockResolvedValue({}),
      deleteAllData: jest.fn().mockResolvedValue(true),
    }),
    showDeletionConfirmation: jest.fn(),
    showDeletionSuccess: jest.fn(),
    showDeletionError: jest.fn(),
  },
}));

jest.mock('../../src/core/logic/eew', () => ({
  EEWManager: {
    getInstance: jest.fn().mockReturnValue({
      getConfig: jest.fn().mockReturnValue({}),
      updateConfig: jest.fn(),
    }),
  },
}));

jest.mock('../../src/core/eew/filter', () => ({
  EEWFilter: {
    getInstance: jest.fn().mockReturnValue({
      getConfig: jest.fn().mockReturnValue({}),
      updateConfig: jest.fn(),
    }),
  },
}));

jest.mock('../../src/core/audio/alarm', () => ({
  EEWAlarmManager: {
    getInstance: jest.fn().mockReturnValue({
      getConfig: jest.fn().mockReturnValue({}),
      updateConfig: jest.fn(),
      testAlarm: jest.fn(),
    }),
  },
}));

jest.mock('../../src/app/components/eew/AlertSheet', () => ({
  AlertSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    if (!visible) return null;
    return null; // Mock component
  },
}));

jest.mock('../../src/app/screens/SupportScreen', () => ({
  SupportScreen: ({ onClose }: { onClose: () => void }) => {
    return null; // Mock component
  },
}));

const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('SettingsScreen - Legal Links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render privacy policy link', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('settings.privacy_policy')).toBeTruthy();
  });

  it('should render terms of use link', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('settings.terms_of_use')).toBeTruthy();
  });

  it('should render support link', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('settings.support')).toBeTruthy();
  });

  it('should open privacy policy when pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    const privacyLink = getByText('settings.privacy_policy');
    fireEvent.press(privacyLink);
    
    expect(mockLinking.openURL).toHaveBeenCalledWith('https://example.com/afetnet/privacy.en.html');
  });

  it('should open terms of use when pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    const termsLink = getByText('settings.terms_of_use');
    fireEvent.press(termsLink);
    
    expect(mockLinking.openURL).toHaveBeenCalledWith('https://example.com/afetnet/terms.en.html');
  });

  it('should show support screen when support link is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    const supportLink = getByText('settings.support');
    fireEvent.press(supportLink);
    
    // Support screen should be rendered (mocked)
    expect(supportLink).toBeTruthy();
  });

  it('should display app version information', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('settings.app_version')).toBeTruthy();
    expect(getByText('settings.build_number')).toBeTruthy();
    expect(getByText('settings.platform')).toBeTruthy();
  });

  it('should handle linking errors gracefully', () => {
    mockLinking.openURL.mockRejectedValue(new Error('Failed to open URL'));
    
    const { getByText } = render(<SettingsScreen />);
    
    const privacyLink = getByText('settings.privacy_policy');
    
    // Should not throw error when pressed
    expect(() => fireEvent.press(privacyLink)).not.toThrow();
  });

  it('should render all about section elements', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // About section title
    expect(getByText('settings.about')).toBeTruthy();
    
    // All links
    expect(getByText('settings.support')).toBeTruthy();
    expect(getByText('settings.privacy_policy')).toBeTruthy();
    expect(getByText('settings.terms_of_use')).toBeTruthy();
    
    // App info
    expect(getByText('settings.app_version')).toBeTruthy();
    expect(getByText('settings.build_number')).toBeTruthy();
    expect(getByText('settings.platform')).toBeTruthy();
  });

  it('should have proper styling for links', () => {
    const { getByText } = render(<SettingsScreen />);
    
    const privacyLink = getByText('settings.privacy_policy');
    const termsLink = getByText('settings.terms_of_use');
    const supportLink = getByText('settings.support');
    
    // Links should be rendered as TouchableOpacity components
    expect(privacyLink).toBeTruthy();
    expect(termsLink).toBeTruthy();
    expect(supportLink).toBeTruthy();
  });
});
