module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-maplibre-gl$': '<rootDir>/__mocks__/react-native-maplibre-gl.js',
    '^react-native-ble-plx$': '<rootDir>/__mocks__/react-native-ble-plx.js',
    '^react-native-multipeer$': '<rootDir>/__mocks__/react-native-multipeer.js',
    '^react-native-google-nearby-connection$': '<rootDir>/__mocks__/react-native-google-nearby-connection.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@expo|expo|@watermelondb|tweetnacl|cbor)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};