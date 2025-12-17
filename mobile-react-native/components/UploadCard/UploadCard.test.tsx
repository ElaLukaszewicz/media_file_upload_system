import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { UploadCard } from './UploadCard';
import type { UploadItem } from '../../../shared/uploadState';

const mockOnPause = jest.fn();
const mockOnResume = jest.fn();
const mockOnCancel = jest.fn();
const mockOnRetry = jest.fn();

const createMockUploadItem = (overrides?: Partial<UploadItem>): UploadItem => ({
  file: {
    id: 'test-id',
    name: 'test-file.jpg',
    size: 1024 * 1024, // 1 MB
    type: 'image/jpeg',
    uri: 'file://test-uri',
  },
  status: 'uploading',
  progress: {
    uploadedBytes: 512 * 1024, // 512 KB
    totalBytes: 1024 * 1024, // 1 MB
    percent: 50,
  },
  retries: 0,
  ...overrides,
});

describe('UploadCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders file information correctly', () => {
    const item = createMockUploadItem();
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(getByText('test-file.jpg')).toBeTruthy();
    expect(getByText('1.0 MB')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
  });

  it('displays thumbnail when uri is provided', () => {
    const item = createMockUploadItem();
    const { UNSAFE_getAllByType } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    const Image = require('react-native').Image;
    const images = UNSAFE_getAllByType(Image);
    expect(images.length).toBeGreaterThan(0);
  });

  it('does not display thumbnail when uri is not provided', () => {
    const item = createMockUploadItem({
      file: {
        id: 'test-id',
        name: 'test-file.jpg',
        size: 1024,
        type: 'image/jpeg',
      },
    });
    const { queryByTestId } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    // Thumbnail should not be rendered
    expect(queryByTestId('thumbnail')).toBeNull();
  });

  it('shows pause button when status is uploading', () => {
    const item = createMockUploadItem({ status: 'uploading' });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    const pauseButton = getByText('Pause');
    expect(pauseButton).toBeTruthy();
    fireEvent.press(pauseButton);
    expect(mockOnPause).toHaveBeenCalledWith('test-id');
  });

  it('shows resume button when status is paused', () => {
    const item = createMockUploadItem({ status: 'paused' });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    const resumeButton = getByText('Resume');
    expect(resumeButton).toBeTruthy();
    fireEvent.press(resumeButton);
    expect(mockOnResume).toHaveBeenCalledWith('test-id');
  });

  it('shows retry button when status is error', () => {
    const item = createMockUploadItem({ status: 'error', errorMessage: 'Upload failed' });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();
    fireEvent.press(retryButton);
    expect(mockOnRetry).toHaveBeenCalledWith('test-id');
  });

  it('shows queued status when status is queued', () => {
    const item = createMockUploadItem({ status: 'queued' });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(getByText('Queued')).toBeTruthy();
  });

  it('shows error message when present', () => {
    const item = createMockUploadItem({ errorMessage: 'Network error occurred' });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(getByText('Network error occurred')).toBeTruthy();
  });

  it('calls onCancel when cancel button is pressed', () => {
    const item = createMockUploadItem();
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    const cancelButton = getByText('Cancel');
    fireEvent.press(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledWith('test-id');
  });

  it('does not show action buttons when status is completed', () => {
    const item = createMockUploadItem({
      status: 'completed',
      progress: { uploadedBytes: 1024 * 1024, totalBytes: 1024 * 1024, percent: 100 },
    });
    const { queryByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(queryByText('Pause')).toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Retry')).toBeNull();
    expect(queryByText('Cancel')).toBeNull();
  });

  it('displays correct progress percentage', () => {
    const item = createMockUploadItem({
      progress: { uploadedBytes: 750 * 1024, totalBytes: 1024 * 1024, percent: 75 },
    });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(getByText('75%')).toBeTruthy();
  });

  it('formats file size correctly', () => {
    const item = createMockUploadItem({
      file: { id: 'test-id', name: 'test.jpg', size: 2048, type: 'image/jpeg' },
    });
    const { getByText } = render(
      <UploadCard
        item={item}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />,
    );

    expect(getByText('2.0 KB')).toBeTruthy();
  });
});
