import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HistoryPage from './History';
import { loadUploadHistory } from '../utils/uploadHistory';

vi.mock('../utils/uploadHistory');
vi.mock('../components', () => ({
  HistoryItem: ({ item }: { item: any }) => <div data-testid="history-item">{item.name}</div>,
}));

const mockLoadUploadHistory = loadUploadHistory as ReturnType<typeof vi.fn>;

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadUploadHistory.mockReturnValue([]);
  });

  it('should render empty state when no history', async () => {
    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No uploads yet.')).toBeTruthy();
    });
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

    mockLoadUploadHistory.mockReturnValue(historyItems);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeTruthy();
      expect(screen.getByText('test2.png')).toBeTruthy();
    });
  });

  it('should display history heading and description', async () => {
    const historyItems = [
      {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        completedAt: '2024-01-15T10:30:00Z',
      },
    ];

    mockLoadUploadHistory.mockReturnValue(historyItems);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Upload history')).toBeTruthy();
      expect(
        screen.getByText('Shows completed uploads stored locally in this browser.'),
      ).toBeTruthy();
    });
  });

  it('should render history list with proper accessibility', () => {
    const historyItems = [
      {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        completedAt: '2024-01-15T10:30:00Z',
      },
    ];

    mockLoadUploadHistory.mockReturnValue(historyItems);

    render(<HistoryPage />);

    const list = screen.getByLabelText('Completed uploads');
    expect(list).toBeTruthy();
    expect(list.tagName).toBe('UL');
  });
});
