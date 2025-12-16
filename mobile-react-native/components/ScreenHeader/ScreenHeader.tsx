import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  debugInfo?: string;
}

function ScreenHeaderComponent({ title, subtitle, debugInfo }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {debugInfo && __DEV__ && (
        <Text style={styles.debugText} numberOfLines={1}>
          {debugInfo}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  debugText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});

export const ScreenHeader = React.memo(ScreenHeaderComponent);
