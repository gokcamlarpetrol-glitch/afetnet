const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ELITE: Bundle optimization
config.resolver.assetExts.push(
  'db',
  'mp3',
  'ttf',
  'obj',
  'png',
  'jpg'
);

// NOTE: Icon fonts will be optimized in native build with ProGuard

// ELITE: Enable minification
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    compress: {
      // Drop console in production
      drop_console: true,
      // Remove dead code
      dead_code: true,
      // Optimize comparisons
      comparisons: true,
      // Inline functions
      inline: 2,
      // Reduce variables
      reduce_vars: true,
      // Collapse single-use vars
      collapse_vars: true,
      // Remove unused code
      unused: true,
    },
    mangle: {
      // Mangle variable names for smaller size
      toplevel: true,
      // Keep class names for debugging
      keep_classnames: false,
      // Keep function names for debugging
      keep_fnames: false,
    },
    output: {
      // Remove comments
      comments: false,
      // Use ASCII only
      ascii_only: true,
    },
  },
};

// ELITE: Keep default serializer for compatibility

module.exports = config;
