const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add video support
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'mkv');

// ELITE: Production build optimization
// Remove console.log statements in production builds
if (process.env.NODE_ENV === 'production') {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      ...config.transformer?.minifierConfig,
      keep_classnames: false,
      keep_fnames: false,
      mangle: {
        keep_classnames: false,
        keep_fnames: false,
      },
      output: {
        comments: false,
      },
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
  };
}

module.exports = config;

