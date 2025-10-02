import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../../src/app/screens/SettingsScreen';
import { DataDeletionManager } from '../../src/core/data/deletion';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../src/core/data/deletion');
jest.mock('../../src/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockDataDeletionManager = DataDeletionManager as jest.Mocked<typeof DataDeletionManager>;

describe('SettingsScreen - Data Deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock DataDeletionManager methods
    mockDataDeletionManager.getInstance.mockReturnValue({
      getDataSummary: jest.fn().mockResolvedValue({
        helpRequests: 5,
        resourcePosts: 3,
        damageReports: 2,
        familyMembers: 4,
        totalSize: '2.5 MB',
      }),
      deleteAllData: jest.fn().mockResolvedValue(true),
    } as any);
    
    mockDataDeletionManager.showDeletionConfirmation.mockImplementation((callback) => {
      callback();
    });
    
    mockDataDeletionManager.showDeletionSuccess.mockImplementation(() => {});
    mockDataDeletionManager.showDeletionError.mockImplementation(() => {});
  });

  it('should display data summary correctly', async () => {
    const { getByText } = render(<SettingsScreen />);
    
    await waitFor(() => {
      expect(getByText('settings.data_summary')).toBeTruthy();
      expect(getByText('settings.help_requests')).toBeTruthy();
      expect(getByText('settings.resource_posts')).toBeTruthy();
      expect(getByText('settings.damage_reports')).toBeTruthy();
      expect(getByText('settings.family_members')).toBeTruthy();
      expect(getByText('settings.total_size')).toBeTruthy();
    });
  });

  it('should show delete all data button', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('settings.delete_all_data')).toBeTruthy();
  });

  it('should handle delete all data button press', async () => {
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockDataDeletionManager.showDeletionConfirmation).toHaveBeenCalled();
    });
  });

  it('should call deleteAllData when confirmed', async () => {
    const mockDeleteAllData = jest.fn().mockResolvedValue(true);
    mockDataDeletionManager.getInstance.mockReturnValue({
      getDataSummary: jest.fn().mockResolvedValue({}),
      deleteAllData: mockDeleteAllData,
    } as any);
    
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockDeleteAllData).toHaveBeenCalled();
    });
  });

  it('should show success message after successful deletion', async () => {
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockDataDeletionManager.showDeletionSuccess).toHaveBeenCalled();
    });
  });

  it('should show error message after failed deletion', async () => {
    const mockDeleteAllData = jest.fn().mockResolvedValue(false);
    mockDataDeletionManager.getInstance.mockReturnValue({
      getDataSummary: jest.fn().mockResolvedValue({}),
      deleteAllData: mockDeleteAllData,
    } as any);
    
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockDataDeletionManager.showDeletionError).toHaveBeenCalled();
    });
  });

  it('should handle deletion errors gracefully', async () => {
    const mockDeleteAllData = jest.fn().mockRejectedValue(new Error('Deletion failed'));
    mockDataDeletionManager.getInstance.mockReturnValue({
      getDataSummary: jest.fn().mockResolvedValue({}),
      deleteAllData: mockDeleteAllData,
    } as any);
    
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockDataDeletionManager.showDeletionError).toHaveBeenCalled();
    });
  });

  it('should refresh data summary after successful deletion', async () => {
    const mockGetDataSummary = jest.fn()
      .mockResolvedValueOnce({
        helpRequests: 5,
        resourcePosts: 3,
        damageReports: 2,
        familyMembers: 4,
        totalSize: '2.5 MB',
      })
      .mockResolvedValueOnce({
        helpRequests: 0,
        resourcePosts: 0,
        damageReports: 0,
        familyMembers: 0,
        totalSize: '0 MB',
      });
    
    mockDataDeletionManager.getInstance.mockReturnValue({
      getDataSummary: mockGetDataSummary,
      deleteAllData: jest.fn().mockResolvedValue(true),
    } as any);
    
    const { getByText } = render(<SettingsScreen />);
    
    const deleteButton = getByText('settings.delete_all_data');
    fireEvent.press(deleteButton);
    
    await waitFor(() => {
      expect(mockGetDataSummary).toHaveBeenCalledTimes(2);
    });
  });
});
