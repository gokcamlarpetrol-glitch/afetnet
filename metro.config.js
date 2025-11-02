import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = getDefaultConfig(__dirname);

// Add video support
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'mkv');

export default config;

