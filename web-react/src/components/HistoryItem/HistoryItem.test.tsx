import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HistoryItem, { type HistoryItemData } from './HistoryItem';

const mockHistoryItem: HistoryItemData = {
  id: 'test-id',
  name: 'test-file.jpg',
  size: 102400,
  type: 'image/jpeg',
  completedAt: '2024-01-15T10:30:00Z',
};

describe('HistoryItem', () => {
  it('renders file information correctly', () => {
    render(<HistoryItem item={mockHistoryItem} />);
    expect(screen.getByText('test-file.jpg')).toBeInTheDocument();
    expect(screen.getByText(/100 KB • image\/jpeg/)).toBeInTheDocument();
  });

  it('displays formatted completion date', () => {
    render(<HistoryItem item={mockHistoryItem} />);
    const dateElement = screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(dateElement).toBeInTheDocument();
  });

  it('uses time element with correct dateTime attribute', () => {
    render(<HistoryItem item={mockHistoryItem} />);
    const timeElement = screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(timeElement.tagName).toBe('TIME');
    expect(timeElement).toHaveAttribute('dateTime', '2024-01-15T10:30:00Z');
  });

  it('calculates file size in KB correctly', () => {
    const smallFile = { ...mockHistoryItem, size: 512 };
    render(<HistoryItem item={smallFile} />);
    expect(screen.getByText(/1 KB/)).toBeInTheDocument();
  });

  it('handles large file sizes correctly', () => {
    const largeFile = { ...mockHistoryItem, size: 5242880 }; // 5MB
    render(<HistoryItem item={largeFile} />);
    expect(screen.getByText(/5120 KB/)).toBeInTheDocument();
  });

  it('renders all required information', () => {
    render(<HistoryItem item={mockHistoryItem} />);
    expect(screen.getByText('test-file.jpg')).toBeInTheDocument();
    expect(screen.getByText(/image\/jpeg/)).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeInTheDocument();
  });
});

