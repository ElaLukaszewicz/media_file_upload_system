import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenHeader } from './ScreenHeader';

describe('ScreenHeader', () => {
  it('renders title correctly', () => {
    const { getByText } = render(<ScreenHeader title="Test Title" />);
    expect(getByText('Test Title')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(<ScreenHeader title="Test Title" subtitle="Test Subtitle" />);
    expect(getByText('Test Subtitle')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    const { queryByText } = render(<ScreenHeader title="Test Title" />);
    expect(queryByText('Test Subtitle')).toBeNull();
  });

  it('renders debug info in development mode', () => {
    const originalDev = __DEV__;
    // @ts-ignore
    global.__DEV__ = true;

    const { getByText } = render(<ScreenHeader title="Test Title" debugInfo="Debug information" />);
    expect(getByText('Debug information')).toBeTruthy();

    // @ts-ignore
    global.__DEV__ = originalDev;
  });

  it('does not render debug info when not in development mode', () => {
    const originalDev = __DEV__;
    // @ts-ignore
    global.__DEV__ = false;

    const { queryByText } = render(
      <ScreenHeader title="Test Title" debugInfo="Debug information" />,
    );
    expect(queryByText('Debug information')).toBeNull();

    // @ts-ignore
    global.__DEV__ = originalDev;
  });

  it('does not render debug info when not provided', () => {
    const { queryByText } = render(<ScreenHeader title="Test Title" />);
    expect(queryByText(/Debug/)).toBeNull();
  });

  it('handles long titles correctly', () => {
    const longTitle = 'A'.repeat(200);
    const { getByText } = render(<ScreenHeader title={longTitle} />);
    expect(getByText(longTitle)).toBeTruthy();
  });

  it('renders all props together', () => {
    const originalDev = __DEV__;
    // @ts-ignore
    global.__DEV__ = true;

    const { getByText } = render(
      <ScreenHeader title="Main Title" subtitle="Subtitle text" debugInfo="Debug info" />,
    );

    expect(getByText('Main Title')).toBeTruthy();
    expect(getByText('Subtitle text')).toBeTruthy();
    expect(getByText('Debug info')).toBeTruthy();

    // @ts-ignore
    global.__DEV__ = originalDev;
  });
});
