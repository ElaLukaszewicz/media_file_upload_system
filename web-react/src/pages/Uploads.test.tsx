import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UploadsPage from './Uploads';
import { useUploadContext } from '../state/uploadContext';
import { useFileValidation } from '../hooks/useFileValidation';

vi.mock('../state/uploadContext');
vi.mock('../hooks/useFileValidation');
vi.mock('../components', () => ({
  UploadCard: ({ item }: { item: any }) => <div data-testid="upload-card">{item.file.name}</div>,
  DropZone: ({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) => (
    <button
      data-testid="dropzone"
      onClick={() => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        onFilesSelected([file]);
      }}
    >
      Select Files
    </button>
  ),
}));

const mockUseUploadContext = useUploadContext as ReturnType<typeof vi.fn>;
const mockUseFileValidation = useFileValidation as ReturnType<typeof vi.fn>;

describe('UploadsPage', () => {
  const mockController = {
    enqueue: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    clearCompleted: vi.fn(),
  };

  const mockValidation = {
    validationError: null,
    validateAndSetError: vi.fn(() => true),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUploadContext.mockReturnValue({
      state: {
        items: [],
        overallPercent: 0,
      },
      controller: mockController,
    });

    mockUseFileValidation.mockReturnValue(mockValidation);
  });

  it('should render upload page', () => {
    render(<UploadsPage />);
    expect(screen.getByText('Upload manager')).toBeTruthy();
  });

  it('should display empty state when no uploads', () => {
    render(<UploadsPage />);
    expect(screen.getByText('No uploads yet. Add files to get started.')).toBeTruthy();
  });

  it('should display upload cards when items exist', () => {
    mockUseUploadContext.mockReturnValue({
      state: {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
            },
            status: 'uploading',
            progress: {
              uploadedBytes: 512,
              totalBytes: 1024,
              percent: 50,
            },
            retries: 0,
          },
        ],
        overallPercent: 50,
      },
      controller: mockController,
    });

    render(<UploadsPage />);
    expect(screen.getByText('test.jpg')).toBeTruthy();
  });

  it('should display validation error when present', () => {
    render(<UploadsPage />);
    expect(screen.getByText('File is too large')).toBeTruthy();
  });

  it('should handle file selection', () => {
    render(<UploadsPage />);

    const dropzone = screen.getByTestId('dropzone');
    dropzone.click();

    expect(mockValidation.validateAndSetError).toHaveBeenCalled();
    expect(mockController.enqueue).toHaveBeenCalled();
  });

  it('should not enqueue files if validation fails', () => {
    mockValidation.validateAndSetError.mockReturnValue(false);

    render(<UploadsPage />);

    const dropzone = screen.getByTestId('dropzone');
    dropzone.click();

    expect(mockValidation.validateAndSetError).toHaveBeenCalled();
    expect(mockController.enqueue).not.toHaveBeenCalled();
  });

  it('should clear error on successful validation', () => {
    mockValidation.validateAndSetError.mockReturnValue(true);

    render(<UploadsPage />);

    const dropzone = screen.getByTestId('dropzone');
    dropzone.click();

    expect(mockValidation.clearError).toHaveBeenCalled();
  });
});
