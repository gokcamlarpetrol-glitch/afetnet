const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const defaultConfig = getDefaultConfig(__dirname);
defaultConfig.resolver.assetExts.push('mbtiles','md');
module.exports = mergeConfig(defaultConfig, {
  resolver: { assetExts: defaultConfig.resolver.assetExts },
});