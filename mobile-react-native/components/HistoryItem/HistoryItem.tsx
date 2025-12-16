import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UploadHistoryItem } from '../../utils/uploadHistory';
import { formatFileSize, formatDate } from '../../utils/fileUtils';

export interface HistoryItemProps {
  item: UploadHistoryItem;
}

function HistoryItemComponent({ item }: HistoryItemProps) {
  const fileSizeFormatted = useMemo(() => formatFileSize(item.size), [item.size]);
  const dateFormatted = useMemo(() => formatDate(item.completedAt), [item.completedAt]);

  return (
    <View style={styles.item}>
      <View style={styles.content}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.metadata}>
          {fileSizeFormatted} • {dateFormatted}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  metadata: {
    fontSize: 14,
    color: '#8E8E93',
  },
});

export const HistoryItem = React.memo(HistoryItemComponent);
