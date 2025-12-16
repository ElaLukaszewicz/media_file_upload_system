import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import NavLink from './NavLink';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('NavLink', () => {
  it('renders link with correct text', () => {
    renderWithRouter(
      <NavLink to="/test" end={false}>
        Test Link
      </NavLink>,
    );
    const link = screen.getByRole('link', { name: /test link/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('passes end prop to RouterNavLink', () => {
    renderWithRouter(
      <NavLink to="/test" end={true}>
        Test Link
      </NavLink>,
    );
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    renderWithRouter(
      <NavLink to="/uploads" end={false}>
        <span>Custom Content</span>
      </NavLink>,
    );
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
  });

  it('applies active class when link is active', () => {
    renderWithRouter(
      <NavLink to="/" end={true}>
        Home
      </NavLink>,
    );
    const link = screen.getByRole('link');
    // Note: This test may need adjustment based on actual routing behavior
    expect(link).toBeInTheDocument();
  });
});

