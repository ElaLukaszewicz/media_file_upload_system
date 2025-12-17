import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUploadContext } from '../state/uploadContext';
import { useFileValidation, createFileDescriptors } from '../hooks/useFileValidation';
import { UploadCard, ScreenHeader, EmptyState } from '../components';
import { processImagePickerAssets, type ProcessedFile } from '../utils/fileUtils';
import { VALIDATION_CONFIG } from '../constants';
import type { UploadItem } from '../../shared/uploadState';

export function UploadScreen() {
  const { state, controller } = useUploadContext();
  const { validationError, validateAndSetError, clearError } = useFileValidation(
    state.items,
    VALIDATION_CONFIG,
  );

  const [isPicking, setIsPicking] = useState(false);

  // Show API URL in development mode for debugging
  const apiBaseUrl = useMemo(
    () => process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    [],
  );

  const requestPermission = useCallback(
    async (
      permissionRequest: () => Promise<{ status: ImagePicker.PermissionStatus }>,
      permissionName: string,
    ): Promise<boolean> => {
      if (Platform.OS === 'web') return true;

      const { status } = await permissionRequest();
      if (status !== 'granted') {
        Alert.alert('Permission Required', `Please grant ${permissionName} permission.`);
        return false;
      }
      return true;
    },
    [],
  );

  const handleFileSelection = useCallback(
    async (
      pickerFunction: () => Promise<ImagePicker.ImagePickerResult>,
      permissionRequest?: () => Promise<{ status: ImagePicker.PermissionStatus }>,
      permissionName?: string,
    ) => {
      if (permissionRequest && permissionName) {
        const hasPermissions = await requestPermission(permissionRequest, permissionName);
        if (!hasPermissions) return;
      }

      setIsPicking(true);
      try {
        const result = await pickerFunction();

        if (!result.canceled && result.assets) {
          const files: ProcessedFile[] = processImagePickerAssets(result.assets);

          if (files.length > 0) {
            clearError(); // reset any previous error before validating new selection
            const isValid = validateAndSetError(files);
            if (!isValid) return;
            const descriptors = createFileDescriptors(files);
            const fileUris = files.map((f) => f.uri);
            controller.enqueue(descriptors, fileUris);
          }
        }
      } catch (error) {
        Alert.alert(
          'Error',
          `Failed to select files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        setIsPicking(false);
      }
    },
    [requestPermission, validateAndSetError, clearError, controller],
  );

  const handlePickFiles = useCallback(() => {
    handleFileSelection(
      () =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsMultipleSelection: true,
          quality: 1,
        }),
      ImagePicker.requestMediaLibraryPermissionsAsync,
      'media library',
    );
  }, [handleFileSelection]);

  const handleCameraCapture = useCallback(() => {
    handleFileSelection(
      () =>
        ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 1,
          allowsEditing: false,
        }),
      ImagePicker.requestCameraPermissionsAsync,
      'camera',
    );
  }, [handleFileSelection]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ScreenHeader title="Upload Files" debugInfo={`API: ${apiBaseUrl}`} />

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handlePickFiles}
            disabled={isPicking}
          >
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Pick from Library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCameraCapture}
            disabled={isPicking}
          >
            <Ionicons name="camera-outline" size={24} color="#007AFF" />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {validationError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText} numberOfLines={3}>
              {validationError}
            </Text>
          </View>
        )}

        {state.items.length === 0 ? (
          <EmptyState
            icon="cloud-upload-outline"
            title="No uploads yet"
            subtitle="Add files to get started"
          />
        ) : (
          <View style={styles.uploadList}>
            {state.items.map((item: UploadItem) => (
              <UploadCard
                key={item.file.id}
                item={item}
                onPause={controller.pause}
                onResume={controller.resume}
                onCancel={controller.cancel}
                onRetry={controller.retry}
              />
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  uploadList: {
    marginTop: 8,
  },
});
