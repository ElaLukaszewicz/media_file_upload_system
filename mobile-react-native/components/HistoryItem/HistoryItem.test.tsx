import React from 'react';
import { render } from '@testing-library/react-native';
import { HistoryItem } from './HistoryItem';
import type { UploadHistoryItem } from '../../utils/uploadHistory';

const createMockHistoryItem = (overrides?: Partial<UploadHistoryItem>): UploadHistoryItem => ({
  id: 'test-id',
  name: 'test-file.jpg',
  size: 1024 * 1024, // 1 MB
  type: 'image/jpeg',
  completedAt: '2024-01-15T10:30:00Z',
  ...overrides,
});

describe('HistoryItem', () => {
  it('renders file name correctly', () => {
    const item = createMockHistoryItem();
    const { getByText } = render(<HistoryItem item={item} />);

    expect(getByText('test-file.jpg')).toBeTruthy();
  });

  it('displays formatted file size and date', () => {
    const item = createMockHistoryItem();
    const { getByText } = render(<HistoryItem item={item} />);

    expect(getByText(/1\.0 MB/)).toBeTruthy();
    expect(getByText(/Jan 15, 2024/)).toBeTruthy();
  });

  it('formats different file sizes correctly', () => {
    const smallFile = createMockHistoryItem({ size: 512 });
    const { getByText: getByTextSmall } = render(<HistoryItem item={smallFile} />);
    expect(getByTextSmall(/512 B/)).toBeTruthy();

    const largeFile = createMockHistoryItem({ size: 5 * 1024 * 1024 });
    const { getByText: getByTextLarge } = render(<HistoryItem item={largeFile} />);
    expect(getByTextLarge(/5\.0 MB/)).toBeTruthy();
  });

  it('handles long file names with numberOfLines', () => {
    const longName = 'a'.repeat(100) + '.jpg';
    const item = createMockHistoryItem({ name: longName });
    const { getByText } = render(<HistoryItem item={item} />);

    expect(getByText(longName)).toBeTruthy();
  });

  it('displays metadata in correct format', () => {
    const item = createMockHistoryItem();
    const { getByText } = render(<HistoryItem item={item} />);

    // Should contain both size and date separated by bullet
    const metadata = getByText(/•/);
    expect(metadata).toBeTruthy();
  });
});
