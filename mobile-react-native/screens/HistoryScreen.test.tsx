import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { HistoryScreen } from './HistoryScreen';
import { loadUploadHistory, cleanupHistory } from '../utils/uploadHistory';
import { useFocusEffect } from '@react-navigation/native';

jest.mock('../utils/uploadHistory');
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useFocusEffect: jest.fn((callback) => {
      // Call the callback immediately for testing
      const ReactLocal = require('react');
      ReactLocal.useEffect(() => {
        callback();
      }, []);
    }),
  };
});

const mockLoadUploadHistory = loadUploadHistory as jest.MockedFunction<typeof loadUploadHistory>;
const mockCleanupHistory = cleanupHistory as jest.MockedFunction<typeof cleanupHistory>;

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCleanupHistory.mockResolvedValue(undefined);
    mockLoadUploadHistory.mockResolvedValue([]);
  });

  it('should render empty state when no history', async () => {
    const { getByText } = render(<HistoryScreen />);

    await waitFor(() => {
      expect(getByText('No uploads yet')).toBeTruthy();
      expect(getByText('Completed uploads will appear here')).toBeTruthy();
    });
  });

  it('should render loading state initially', async () => {
    mockLoadUploadHistory.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
    );

    const { getByText } = render(<HistoryScreen />);

    expect(getByText('Loading...')).toBeTruthy();
  });

  it('should load and display history items', async () => {
    const historyItems = [
      {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        completedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 'file-2',
        name: 'test2.png',
        size: 2048,
        type: 'image/png',
        completedAt: '2024-01-16T11:00:00Z',
      },
    ];

    mockLoadUploadHistory.mockResolvedValue(historyItems);

    const { getByText } = render(<HistoryScreen />);

    await waitFor(() => {
      expect(getByText('test.jpg')).toBeTruthy();
      expect(getByText('test2.png')).toBeTruthy();
    });
  });

  it('should cleanup history before loading', async () => {
    render(<HistoryScreen />);

    await waitFor(() => {
      expect(mockCleanupHistory).toHaveBeenCalled();
      expect(mockLoadUploadHistory).toHaveBeenCalled();
    });
  });

  it('should refresh history when screen comes into focus', async () => {
    const { rerender } = render(<HistoryScreen />);

    await waitFor(() => {
      expect(mockLoadUploadHistory).toHaveBeenCalledTimes(1);
    });

    // Simulate focus effect
    const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<typeof useFocusEffect>;
    const focusCallback = mockUseFocusEffect.mock.calls[0][0];

    // Call the focus callback again synchronously
    await act(async () => {
      focusCallback();
    });

    rerender(<HistoryScreen />);

    await waitFor(() => {
      expect(mockLoadUploadHistory).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadUploadHistory.mockRejectedValue(new Error('Load failed'));

    render(<HistoryScreen />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load upload history:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
