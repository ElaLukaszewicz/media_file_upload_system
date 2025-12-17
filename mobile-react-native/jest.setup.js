// Mock React Native core modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules = RN.NativeModules || {};
  const EventEmitter = require('events');
  const appStateEmitter = new EventEmitter();
  const AppState = {
    currentState: 'active',
    addEventListener: jest.fn((event, handler) => {
      appStateEmitter.on(event, handler);
      return { remove: () => appStateEmitter.off(event, handler) };
    }),
    removeEventListener: jest.fn((event, handler) => appStateEmitter.off(event, handler)),
    emit: (event, state) => appStateEmitter.emit(event, state),
  };
  RN.AppState = AppState;
  return RN;
});

// Mock expo modules before any imports
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  MediaTypeOptions: {
    All: 'all',
    Images: 'images',
    Videos: 'videos',
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  cacheDirectory: 'file:///test/cache/',
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  getStatusAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
