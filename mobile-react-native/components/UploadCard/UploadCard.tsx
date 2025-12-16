import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UploadItem, UploadStatus } from '../../../shared/uploadState';
import { formatFileSize } from '../../utils/fileUtils';

export interface UploadCardProps {
  item: UploadItem;
  onPause: (uploadId: string) => void;
  onResume: (uploadId: string) => void;
  onCancel: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
}

const getStatusColor = (status: UploadStatus): string => {
  switch (status) {
    case 'completed':
      return '#34C759';
    case 'error':
      return '#FF3B30';
    case 'uploading':
      return '#007AFF';
    case 'paused':
      return '#FF9500';
    default:
      return '#8E8E93';
  }
};

function UploadCardComponent({ item, onPause, onResume, onCancel, onRetry }: UploadCardProps) {
  const { file, status, progress, errorMessage } = item;

  const statusColor = useMemo(() => getStatusColor(status), [status]);
  const fileSizeFormatted = useMemo(() => formatFileSize(file.size), [file.size]);
  const progressPercent = useMemo(() => progress.percent, [progress.percent]);

  const handlePause = useCallback(() => {
    onPause(file.id);
  }, [file.id, onPause]);

  const handleResume = useCallback(() => {
    onResume(file.id);
  }, [file.id, onResume]);

  const handleCancel = useCallback(() => {
    onCancel(file.id);
  }, [file.id, onCancel]);

  const handleRetry = useCallback(() => {
    onRetry(file.id);
  }, [file.id, onRetry]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {file.uri && (
          <Image source={{ uri: file.uri }} style={styles.thumbnail} resizeMode="cover" />
        )}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
          <Text style={styles.fileSize}>{fileSizeFormatted}</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%`, backgroundColor: statusColor },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progressPercent}%</Text>
          </View>
        </View>
      </View>

      {errorMessage && (
        <Text style={styles.errorText} numberOfLines={2}>
          {errorMessage}
        </Text>
      )}

      {__DEV__ && <Text style={styles.debugText}>Status: {status}</Text>}

      {status !== 'completed' && (
        <View style={styles.actions}>
          {status === 'uploading' && (
            <TouchableOpacity style={styles.actionButton} onPress={handlePause}>
              <Ionicons name="pause" size={20} color="#007AFF" />
              <Text style={styles.actionText}>Pause</Text>
            </TouchableOpacity>
          )}
          {status === 'paused' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleResume}>
              <Ionicons name="play" size={20} color="#007AFF" />
              <Text style={styles.actionText}>Resume</Text>
            </TouchableOpacity>
          )}
          {status === 'error' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#007AFF" />
              <Text style={styles.actionText}>Retry</Text>
            </TouchableOpacity>
          )}
          {status === 'queued' && (
            <View style={styles.statusIndicator}>
              <Ionicons name="time-outline" size={16} color="#8E8E93" />
              <Text style={styles.statusText}>Queued</Text>
            </View>
          )}
          <TouchableOpacity style={styles.actionButton} onPress={handleCancel}>
            <Ionicons name="close-circle" size={20} color="#FF3B30" />
            <Text style={[styles.actionText, styles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    minWidth: 40,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    minHeight: 40,
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  cancelText: {
    color: '#FF3B30',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 'auto',
  },
  statusText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export const UploadCard = React.memo(UploadCardComponent);
