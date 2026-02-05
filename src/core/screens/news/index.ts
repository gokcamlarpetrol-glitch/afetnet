/**
 * NEWS SCREENS - BARREL EXPORT
 * Clean module exports for news-related screens and components
 */

// Main screens
export { default as NewsDetailScreen } from './NewsDetailScreen';
export { default as AllNewsScreen } from './AllNewsScreen';

// Components
export * from './components/NewsDetailComponents';

// Styles
export { styles as newsDetailStyles, CREAM_BACKGROUND } from './styles/newsDetailStyles';

// Utils
export * from './utils/newsDetailUtils';
