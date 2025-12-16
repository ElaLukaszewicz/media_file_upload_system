import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import UploadCard from './UploadCard';
import type { UploadItem } from '@shared/uploadState';

const mockUploadItem: UploadItem = {
  file: {
    id: 'test-id',
    name: 'test-file.jpg',
    size: 102400,
    type: 'image/jpeg',
    previewUrl: 'blob:http://localhost/test.jpg',
  },
  status: 'uploading',
  progress: {
    uploadedBytes: 51200,
    totalBytes: 102400,
    percent: 50,
  },
  retries: 0,
};

describe('UploadCard', () => {
  const mockCallbacks = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file information correctly', () => {
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    expect(screen.getByText('test-file.jpg')).toBeInTheDocument();
    expect(screen.getByText(/100 KB • image\/jpeg/)).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', () => {
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows pause button when status is uploading', () => {
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();
  });

  it('calls onPause when pause button is clicked', async () => {
    const user = userEvent.setup();
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    await user.click(pauseButton);
    expect(mockCallbacks.onPause).toHaveBeenCalledWith('test-id');
  });

  it('shows resume button when status is paused', () => {
    const pausedItem = { ...mockUploadItem, status: 'paused' as const };
    render(<UploadCard item={pausedItem} {...mockCallbacks} />);
    const resumeButton = screen.getByRole('button', { name: /resume/i });
    expect(resumeButton).toBeInTheDocument();
  });

  it('calls onResume when resume button is clicked', async () => {
    const user = userEvent.setup();
    const pausedItem = { ...mockUploadItem, status: 'paused' as const };
    render(<UploadCard item={pausedItem} {...mockCallbacks} />);
    const resumeButton = screen.getByRole('button', { name: /resume/i });
    await user.click(resumeButton);
    expect(mockCallbacks.onResume).toHaveBeenCalledWith('test-id');
  });

  it('shows retry button when status is error', () => {
    const errorItem = {
      ...mockUploadItem,
      status: 'error' as const,
      errorMessage: 'Upload failed',
    };
    render(<UploadCard item={errorItem} {...mockCallbacks} />);
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const errorItem = {
      ...mockUploadItem,
      status: 'error' as const,
      errorMessage: 'Upload failed',
    };
    render(<UploadCard item={errorItem} {...mockCallbacks} />);
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);
    expect(mockCallbacks.onRetry).toHaveBeenCalledWith('test-id');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(mockCallbacks.onCancel).toHaveBeenCalledWith('test-id');
  });

  it('displays error message when present', () => {
    const errorItem = {
      ...mockUploadItem,
      status: 'error' as const,
      errorMessage: 'Network error',
    };
    render(<UploadCard item={errorItem} {...mockCallbacks} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toHaveAttribute('role', 'alert');
  });

  it('hides controls when status is completed', () => {
    const completedItem = { ...mockUploadItem, status: 'completed' as const };
    render(<UploadCard item={completedItem} {...mockCallbacks} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides controls when status is idle', () => {
    const idleItem = { ...mockUploadItem, status: 'idle' as const };
    render(<UploadCard item={idleItem} {...mockCallbacks} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    expect(screen.getByText('uploading')).toBeInTheDocument();
  });

  it('displays progress information', () => {
    render(<UploadCard item={mockUploadItem} {...mockCallbacks} />);
    expect(
      screen.getByText(/Uploaded 51200 of 102400 bytes/),
    ).toBeInTheDocument();
  });
});

