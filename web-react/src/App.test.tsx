import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { UploadProvider } from './state/uploadContext';

describe('App', () => {
  it('shows navigation items and overview heading', () => {
    render(
      <BrowserRouter>
        <UploadProvider>
          <App />
        </UploadProvider>
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: /Media upload system/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /uploads/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /history/i })).toBeVisible();
  });
});
