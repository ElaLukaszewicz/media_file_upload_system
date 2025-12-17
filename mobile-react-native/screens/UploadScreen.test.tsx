import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { UploadScreen } from './UploadScreen';
import { useUploadContext } from '../state/uploadContext';
import { useFileValidation, createFileDescriptors } from '../hooks/useFileValidation';
import * as ImagePicker from 'expo-image-picker';
import { processImagePickerAssets } from '../utils/fileUtils';

jest.mock('../state/uploadContext');
jest.mock('../hooks/useFileValidation');
jest.mock('expo-image-picker');
jest.mock('../utils/fileUtils');

const mockUseUploadContext = useUploadContext as jest.MockedFunction<typeof useUploadContext>;
const mockUseFileValidation = useFileValidation as jest.MockedFunction<typeof useFileValidation>;
const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;
const mockLaunchCameraAsync = ImagePicker.launchCameraAsync as jest.MockedFunction<
  typeof ImagePicker.launchCameraAsync
>;
const mockRequestMediaLibraryPermissionsAsync =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<
    typeof ImagePicker.requestMediaLibraryPermissionsAsync
  >;
const mockRequestCameraPermissionsAsync =
  ImagePicker.requestCameraPermissionsAsync as jest.MockedFunction<
    typeof ImagePicker.requestCameraPermissionsAsync
  >;
const mockProcessImagePickerAssets = processImagePickerAssets as jest.MockedFunction<
  typeof processImagePickerAssets
>;

describe('UploadScreen', () => {
  const mockController = {
    enqueue: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    retry: jest.fn(),
    clearCompleted: jest.fn(),
  };

  const mockValidation = {
    validationError: null,
    validateAndSetError: jest.fn(() => true),
    clearError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockUseUploadContext.mockReturnValue({
      state: {
        items: [],
        overallPercent: 0,
      },
      controller: mockController,
    });

    mockUseFileValidation.mockReturnValue(mockValidation);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///path/to/test.jpg',
          fileName: 'test.jpg',
          fileSize: 1024,
          type: 'image',
          width: 100,
          height: 100,
        },
      ],
    });
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///path/to/camera.jpg',
          fileName: 'camera.jpg',
          fileSize: 2048,
          type: 'image',
          width: 200,
          height: 200,
        },
      ],
    });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockProcessImagePickerAssets.mockReturnValue([
      {
        uri: 'file:///path/to/test.jpg',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      },
    ]);
  });

  it('should render upload screen', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText('Upload Files')).toBeTruthy();
  });

  it('should handle file selection from library', async () => {
    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
      expect(mockProcessImagePickerAssets).toHaveBeenCalled();
      expect(mockController.enqueue).toHaveBeenCalled();
    });
  });

  it('should handle camera capture', async () => {
    const { getByText } = render(<UploadScreen />);

    const cameraButton = getByText('Take Photo');
    fireEvent.press(cameraButton);

    await waitFor(() => {
      expect(mockRequestCameraPermissionsAsync).toHaveBeenCalled();
      expect(mockLaunchCameraAsync).toHaveBeenCalled();
      expect(mockController.enqueue).toHaveBeenCalled();
    });
  });

  it('should validate files before enqueueing', async () => {
    mockValidation.validateAndSetError.mockReturnValue(false);

    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(mockValidation.validateAndSetError).toHaveBeenCalled();
      expect(mockController.enqueue).not.toHaveBeenCalled();
    });
  });

  it('should handle permission denial', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission Required',
        'Please grant media library permission.',
      );
      expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
    });
  });

  it('should skip permission check on web', async () => {
    Platform.OS = 'web';

    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('should handle canceled selection', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: undefined,
    });

    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(mockController.enqueue).not.toHaveBeenCalled();
    });
  });

  it('should handle file selection errors', async () => {
    const error = new Error('Selection failed');
    mockLaunchImageLibraryAsync.mockRejectedValue(error);

    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to select files: Selection failed');
    });
  });

  it('should clear validation error on successful selection', async () => {
    const { getByText } = render(<UploadScreen />);

    const pickButton = getByText('Pick from Library');
    fireEvent.press(pickButton);

    await waitFor(() => {
      expect(mockValidation.clearError).toHaveBeenCalled();
    });
  });

  it('should display validation error when present', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText('File is too large')).toBeTruthy();
  });

  it('should show API URL in development mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.100:8000';

    const { getByText } = render(<UploadScreen />);
    expect(getByText(/http:\/\/192\.168\.1\.100:8000/)).toBeTruthy();
  });
});
