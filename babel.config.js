module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: ['babel-preset-expo'],
    plugins: isTest
      ? [] // ELITE: Skip reanimated plugin in test environment to avoid worklets issues
      : ['react-native-reanimated/plugin'],
  };
};
