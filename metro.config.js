const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add video support
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'mkv');

module.exports = config;

