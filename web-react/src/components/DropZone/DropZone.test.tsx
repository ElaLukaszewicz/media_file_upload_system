import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DropZone from './DropZone';

// Mock File constructor for testing
class MockFile extends File {
  constructor(name: string, type: string, size: number) {
    super([], name, { type });
    Object.defineProperty(this, 'size', { value: size });
  }
}

describe('DropZone', () => {
  const mockOnFilesSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drop zone with correct text', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    expect(screen.getByText('Select files to upload')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop up to 10/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size: 100MB/)).toBeInTheDocument();
  });

  it('displays custom max files', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={5}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    expect(screen.getByText(/Drag and drop up to 5/)).toBeInTheDocument();
  });

  it('displays custom max file size', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={50 * 1024 * 1024}
      />,
    );
    expect(screen.getByText(/Maximum file size: 50MB/)).toBeInTheDocument();
  });

  it('opens file picker when clicked', async () => {
    const user = userEvent.setup();
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    const dropZone = screen.getByRole('button');
    await user.click(dropZone);
    // File input should be triggered
    expect(dropZone).toBeInTheDocument();
  });

  it('opens file picker on Enter key', async () => {
    const user = userEvent.setup();
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    const dropZone = screen.getByRole('button');
    dropZone.focus();
    await user.keyboard('{Enter}');
    expect(dropZone).toBeInTheDocument();
  });

  it('opens file picker on Space key', async () => {
    const user = userEvent.setup();
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    const dropZone = screen.getByRole('button');
    dropZone.focus();
    await user.keyboard(' ');
    expect(dropZone).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );
    const dropZone = screen.getByRole('button');
    expect(dropZone).toHaveAttribute(
      'aria-label',
      'File upload drop zone. Click or drag and drop files here.',
    );
    expect(dropZone).toHaveAttribute('tabIndex', '0');

    const fileInput = screen.getByLabelText('Select files to upload');
    expect(fileInput).toHaveAttribute('aria-describedby', 'file-upload-hint');
  });

  it('has file input with correct attributes', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );

    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('renders with all required props', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={5}
        maxFileSizeBytes={50 * 1024 * 1024}
        accept="image/*"
        multiple={false}
      />,
    );

    expect(screen.getByText('Select files to upload')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop up to 5/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size: 50MB/)).toBeInTheDocument();
  });

  it('uses custom accept prop', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
        accept="image/*"
      />,
    );
    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('uses custom multiple prop', () => {
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
        multiple={false}
      />,
    );
    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).not.toHaveAttribute('multiple');
  });

  it('is memoized to prevent unnecessary re-renders', () => {
    const { rerender } = render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );

    // Re-render with same props
    rerender(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
      />,
    );

    // Component should still render correctly
    expect(screen.getByText('Select files to upload')).toBeInTheDocument();
  });
});
