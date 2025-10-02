#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing AfetNet project...');

// Create necessary directories
const directories = [
  'src/assets/mbtiles',
  'src/assets/icons',
  'src/assets/guides',
  'src/core/offline/guides',
];

directories.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Create placeholder files
const placeholderFiles = [
  {
    path: 'src/assets/mbtiles/istanbul.mbtiles',
    content: 'Placeholder MBTiles file. Replace with actual Istanbul map tiles.',
  },
  {
    path: 'src/core/offline/guides/first_aid.md',
    content: '# İlk Yardım Rehberi\n\nBu rehber acil durumlarda temel ilk yardım bilgilerini içerir.',
  },
  {
    path: 'src/core/offline/guides/safety.md',
    content: '# Güvenlik Rehberi\n\nBu rehber afet durumlarında güvenlik önlemlerini açıklar.',
  },
];

placeholderFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file.path);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, file.content);
    console.log(`📄 Created placeholder: ${file.path}`);
  }
});

console.log('✅ Project preparation completed!');
console.log('📋 Next steps:');
console.log('  1. Replace src/assets/mbtiles/istanbul.mbtiles with actual map tiles');
console.log('  2. Update guide markdown files with real content');
console.log('  3. Run "yarn install" to install dependencies');
console.log('  4. Run "yarn dev" to start development');
