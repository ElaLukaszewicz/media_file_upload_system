module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testEnvironment: 'jsdom',
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/state/uploadContext.tsx',
    '/utils/uploadManager.ts',
  ],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'state/**/*.{ts,tsx}',
    'screens/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/index.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
