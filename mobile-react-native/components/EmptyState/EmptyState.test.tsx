import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title correctly', () => {
    const { getByText } = render(<EmptyState title="No items" />);
    expect(getByText('No items')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <EmptyState title="No items" subtitle="Add items to get started" />,
    );
    expect(getByText('Add items to get started')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    const { queryByText } = render(<EmptyState title="No items" />);
    expect(queryByText('Add items to get started')).toBeNull();
  });

  it('renders icon when provided', () => {
    const { UNSAFE_getByType } = render(
      <EmptyState title="No items" icon="cloud-upload-outline" />,
    );

    const Ionicons = require('@expo/vector-icons').Ionicons;
    const icons = UNSAFE_getByType(Ionicons);
    expect(icons.length).toBeGreaterThan(0);
  });

  it('does not render icon when not provided', () => {
    const { UNSAFE_getByType } = render(<EmptyState title="No items" />);

    const Ionicons = require('@expo/vector-icons').Ionicons;
    const icons = UNSAFE_getByType(Ionicons);
    expect(icons.length).toBe(0);
  });

  it('renders all props together', () => {
    const { getByText, UNSAFE_getByType } = render(
      <EmptyState
        title="No uploads yet"
        subtitle="Add files to get started"
        icon="cloud-upload-outline"
      />,
    );

    expect(getByText('No uploads yet')).toBeTruthy();
    expect(getByText('Add files to get started')).toBeTruthy();

    const Ionicons = require('@expo/vector-icons').Ionicons;
    const icons = UNSAFE_getByType(Ionicons);
    expect(icons.length).toBeGreaterThan(0);
  });

  it('handles different icon types', () => {
    const icons = ['cloud-upload-outline', 'images-outline', 'time-outline'];
    icons.forEach((icon) => {
      const { UNSAFE_getByType } = render(<EmptyState title="Test" icon={icon as any} />);
      const Ionicons = require('@expo/vector-icons').Ionicons;
      const renderedIcons = UNSAFE_getByType(Ionicons);
      expect(renderedIcons.length).toBeGreaterThan(0);
    });
  });
});
