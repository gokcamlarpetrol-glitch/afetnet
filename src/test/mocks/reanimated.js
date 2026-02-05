/**
 * REANIMATED MOCK
 * Mock for react-native-reanimated to avoid native module issues in Jest
 */

const actualReanimated = jest.requireActual('react-native-reanimated/mock');

module.exports = {
  ...actualReanimated,
  default: {
    ...actualReanimated.default,
  },
};
