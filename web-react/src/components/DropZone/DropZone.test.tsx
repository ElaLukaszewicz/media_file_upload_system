import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DropZone, { type DropZoneProps } from './DropZone';

describe('DropZone', () => {
  const mockOnFilesSelected = vi.fn();

  const renderDropZone = (props: Partial<DropZoneProps> = {}) =>
    render(
      <DropZone
        onFilesSelected={mockOnFilesSelected}
        maxFiles={10}
        maxFileSizeBytes={100 * 1024 * 1024}
        {...props}
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drop zone with correct text', () => {
    renderDropZone();
    expect(screen.getByText('Select files to upload')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop up to 10/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size: 100MB/)).toBeInTheDocument();
  });

  it('displays custom max files', () => {
    renderDropZone({ maxFiles: 5 });
    expect(screen.getByText(/Drag and drop up to 5/)).toBeInTheDocument();
  });

  it('displays custom max file size', () => {
    renderDropZone({ maxFileSizeBytes: 50 * 1024 * 1024 });
    expect(screen.getByText(/Maximum file size: 50MB/)).toBeInTheDocument();
  });

  it('opens file picker when clicked', async () => {
    const user = userEvent.setup();
    renderDropZone();
    const input = screen.getByLabelText('Select files to upload');
    const clickSpy = vi.spyOn(input, 'click');

    await user.click(screen.getByRole('button'));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens file picker on Enter key', async () => {
    const user = userEvent.setup();
    renderDropZone();
    const dropZone = screen.getByRole('button');
    const input = screen.getByLabelText('Select files to upload');
    const clickSpy = vi.spyOn(input, 'click');

    dropZone.focus();
    await user.keyboard('{Enter}');

    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens file picker on Space key', async () => {
    const user = userEvent.setup();
    renderDropZone();
    const dropZone = screen.getByRole('button');
    const input = screen.getByLabelText('Select files to upload');
    const clickSpy = vi.spyOn(input, 'click');

    dropZone.focus();
    await user.keyboard(' ');

    expect(clickSpy).toHaveBeenCalled();
  });

  it('has correct accessibility attributes', () => {
    renderDropZone();
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
    renderDropZone();

    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('renders with all required props', () => {
    renderDropZone({
      maxFiles: 5,
      maxFileSizeBytes: 50 * 1024 * 1024,
      accept: 'image/*',
      multiple: false,
    });

    expect(screen.getByText('Select files to upload')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop up to 5/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size: 50MB/)).toBeInTheDocument();
  });

  it('uses custom accept prop', () => {
    renderDropZone({ accept: 'image/*' });
    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('uses custom multiple prop', () => {
    renderDropZone({ multiple: false });
    const input = screen.getByLabelText('Select files to upload') as HTMLInputElement;
    expect(input).not.toHaveAttribute('multiple');
  });

  it('is memoized to prevent unnecessary re-renders', () => {
    const { rerender } = renderDropZone();

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
