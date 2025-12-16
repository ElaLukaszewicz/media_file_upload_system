import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FilePreview } from './FilePreview';

describe('FilePreview', () => {
  it('renders image preview for image files', () => {
    render(
      <FilePreview
        previewUrl="blob:http://localhost/image.jpg"
        fileType="image/jpeg"
        fileName="test.jpg"
      />,
    );
    const img = screen.getByAltText('Preview of test.jpg');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:http://localhost/image.jpg');
  });

  it('renders video preview for video files', () => {
    render(
      <FilePreview
        previewUrl="blob:http://localhost/video.mp4"
        fileType="video/mp4"
        fileName="test.mp4"
      />,
    );
    const videoPreview = screen.getByLabelText('Video file preview: test.mp4');
    expect(videoPreview).toBeInTheDocument();
  });

  it('returns null for unsupported file types', () => {
    const { container } = render(
      <FilePreview
        previewUrl="blob:http://localhost/file.pdf"
        fileType="application/pdf"
        fileName="test.pdf"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('has lazy loading for images', () => {
    render(
      <FilePreview
        previewUrl="blob:http://localhost/image.jpg"
        fileType="image/jpeg"
        fileName="test.jpg"
      />,
    );
    const img = screen.getByAltText('Preview of test.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});

