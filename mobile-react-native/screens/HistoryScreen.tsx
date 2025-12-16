import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HistoryItem, ScreenHeader, EmptyState } from '../components';
import { loadUploadHistory, cleanupHistory, type UploadHistoryItem } from '../utils/uploadHistory';

export function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<UploadHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      // Clean up history first to remove any incomplete items
      await cleanupHistory();

      const stored = await loadUploadHistory();
      setHistoryItems(stored);
    } catch (error) {
      console.error('Failed to load upload history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh history when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ScreenHeader title="Upload History" subtitle="Shows completed uploads stored locally" />
        {isLoading ? (
          <EmptyState title="Loading..." />
        ) : historyItems.length === 0 ? (
          <EmptyState title="No uploads yet" subtitle="Completed uploads will appear here" />
        ) : (
          <View style={styles.historyList}>
            {historyItems.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  historyList: {
    marginTop: 8,
  },
});
