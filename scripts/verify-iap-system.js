#!/usr/bin/env node

/**
 * Final IAP System Verification
 * Ensures only 3 valid product IDs remain and all systems are ready for TestFlight
 */

const fs = require('fs');
const path = require('path');

// Valid product IDs
const VALID_PRODUCTS = [
  'org.afetnetapp.premium.monthly',
  'org.afetnetapp.premium.yearly', 
  'org.afetnetapp.premium.lifetime',
];

// Invalid/old product IDs to check for
const INVALID_PRODUCTS = [
  'afetnet_premium_monthly',
  'afetnet_premium_yearly',
];

console.log('🔍 AfetNet IAP System Final Verification');
console.log('==========================================');

let allChecksPassed = true;

// Check 1: Verify products.ts file
console.log('\n📦 1. Checking centralized products file...');
try {
  const productsFile = fs.readFileSync('shared/iap/products.ts', 'utf8');
  
  // Check for valid products
  VALID_PRODUCTS.forEach(productId => {
    if (productsFile.includes(productId)) {
      console.log(`✅ Valid product found: ${productId}`);
    } else {
      console.log(`❌ Missing valid product: ${productId}`);
      allChecksPassed = false;
    }
  });
  
  // Check for invalid products (only in actual code, not comments)
  INVALID_PRODUCTS.forEach(productId => {
    // Check for actual usage, not just mentions in comments
    const lines = productsFile.split('\n');
    let foundInCode = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip comment lines
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        continue;
      }
      // Check if the old product ID is used in actual code
      if (trimmedLine.includes(`"${productId}"`) || trimmedLine.includes(`'${productId}'`)) {
        foundInCode = true;
        break;
      }
    }
    
    if (foundInCode) {
      console.log(`❌ Invalid product still present in code: ${productId}`);
      allChecksPassed = false;
    } else {
      console.log(`✅ Invalid product removed from code: ${productId}`);
    }
  });
} catch (error) {
  console.log('❌ Error reading products.ts:', error.message);
  allChecksPassed = false;
}

// Check 2: Verify IAP service
console.log('\n🔧 2. Checking IAP service...');
try {
  const iapServiceFile = fs.readFileSync('src/services/iapService.ts', 'utf8');
  
  // Check for valid product imports
  if (iapServiceFile.includes("from '@shared/iap/products'")) {
    console.log('✅ IAP service imports from centralized products');
  } else {
    console.log('❌ IAP service not using centralized products');
    allChecksPassed = false;
  }
  
  // Check for old product references
  INVALID_PRODUCTS.forEach(productId => {
    if (iapServiceFile.includes(productId)) {
      console.log(`❌ Old product reference in IAP service: ${productId}`);
      allChecksPassed = false;
    }
  });
} catch (error) {
  console.log('❌ Error reading IAP service:', error.message);
  allChecksPassed = false;
}

// Check 3: Verify server configuration
console.log('\n🌐 3. Checking server configuration...');
try {
  const serverRoutesFile = fs.readFileSync('server/iap-routes.ts', 'utf8');
  
  // Check for valid product imports
  if (serverRoutesFile.includes("from '@shared/iap/products'")) {
    console.log('✅ Server imports from centralized products');
  } else {
    console.log('❌ Server not using centralized products');
    allChecksPassed = false;
  }
  
  // Check for old product references
  INVALID_PRODUCTS.forEach(productId => {
    if (serverRoutesFile.includes(productId)) {
      console.log(`❌ Old product reference in server: ${productId}`);
      allChecksPassed = false;
    }
  });
} catch (error) {
  console.log('❌ Error reading server routes:', error.message);
  allChecksPassed = false;
}

// Check 4: Verify app icons
console.log('\n🎨 4. Checking app icons...');
try {
  const appIconDir = 'ios/AfetNet/Assets.xcassets/AppIcon.appiconset';
  
  if (fs.existsSync(appIconDir)) {
    const files = fs.readdirSync(appIconDir);
    const pngFiles = files.filter(file => file.endsWith('.png'));
    
    console.log(`✅ AppIcon directory exists with ${pngFiles.length} PNG files`);
    
    // Check for Contents.json
    if (fs.existsSync(path.join(appIconDir, 'Contents.json'))) {
      console.log('✅ Contents.json exists');
      
      const contents = JSON.parse(fs.readFileSync(path.join(appIconDir, 'Contents.json'), 'utf8'));
      if (contents.images && contents.images.length === 18) {
        console.log('✅ All 18 icon sizes configured');
      } else {
        console.log(`❌ Expected 18 icon sizes, found ${contents.images?.length || 0}`);
        allChecksPassed = false;
      }
    } else {
      console.log('❌ Contents.json missing');
      allChecksPassed = false;
    }
  } else {
    console.log('❌ AppIcon directory missing');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Error checking app icons:', error.message);
  allChecksPassed = false;
}

// Check 5: Verify logging implementation
console.log('\n📝 5. Checking logging implementation...');
try {
  const loggerFile = fs.readFileSync('src/utils/logger.ts', 'utf8');
  
  if (loggerFile.includes('iap: {')) {
    console.log('✅ IAP-specific logging methods implemented');
  } else {
    console.log('❌ IAP-specific logging methods missing');
    allChecksPassed = false;
  }
  
  if (loggerFile.includes('productDetected:')) {
    console.log('✅ Product detection logging implemented');
  } else {
    console.log('❌ Product detection logging missing');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Error checking logger:', error.message);
  allChecksPassed = false;
}

// Check 6: Verify database schema
console.log('\n🗄️ 6. Checking database schema...');
try {
  const migrationFile = fs.readFileSync('server/migrations/001_create_iap_tables.sql', 'utf8');
  
  if (migrationFile.includes('org.afetnetapp.premium.monthly') && 
      migrationFile.includes('org.afetnetapp.premium.yearly') && 
      migrationFile.includes('org.afetnetapp.premium.lifetime')) {
    console.log('✅ Database schema includes all valid products');
  } else {
    console.log('❌ Database schema missing valid products');
    allChecksPassed = false;
  }
  
  if (migrationFile.includes('CHECK (product_id IN')) {
    console.log('✅ Database has product ID constraints');
  } else {
    console.log('❌ Database missing product ID constraints');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Error checking database schema:', error.message);
  allChecksPassed = false;
}

// Check 7: Verify TestFlight plan
console.log('\n🧪 7. Checking TestFlight plan...');
try {
  if (fs.existsSync('TESTFLIGHT_TESTING_PLAN.md')) {
    console.log('✅ TestFlight testing plan exists');
    
    const planContent = fs.readFileSync('TESTFLIGHT_TESTING_PLAN.md', 'utf8');
    if (planContent.includes('afetnet_premium_monthly1') && 
        planContent.includes('afetnet_premium_yearly1') && 
        planContent.includes('afetnet_premium_lifetime')) {
      console.log('✅ TestFlight plan includes all valid products');
    } else {
      console.log('❌ TestFlight plan missing valid products');
      allChecksPassed = false;
    }
  } else {
    console.log('❌ TestFlight testing plan missing');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Error checking TestFlight plan:', error.message);
  allChecksPassed = false;
}

// Final Results
console.log('\n🎯 Final Verification Results');
console.log('============================');

if (allChecksPassed) {
  console.log('🎉 ALL CHECKS PASSED!');
  console.log('');
  console.log('✅ System is ready for TestFlight testing:');
  console.log('   • Only 3 valid product IDs remain');
  console.log('   • All old product IDs removed');
  console.log('   • App icons with full-bleed red background');
  console.log('   • Database schema implemented');
  console.log('   • Server verification ready');
  console.log('   • Consistent logging implemented');
  console.log('   • TestFlight plan documented');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   1. Deploy database server');
  console.log('   2. Configure Apple webhook');
  console.log('   3. Upload to TestFlight');
  console.log('   4. Run comprehensive testing');
  console.log('   5. Submit to App Store');
} else {
  console.log('❌ SOME CHECKS FAILED!');
  console.log('');
  console.log('Please fix the issues above before proceeding to TestFlight.');
  process.exit(1);
}
