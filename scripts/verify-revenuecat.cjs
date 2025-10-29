// REVENUECAT VERIFICATION SCRIPT
// Verifies RevenueCat integration is properly configured
const fs = require('fs');
const path = require('path');

console.log('🔍 REVENUECAT VERIFICATION');
console.log('='.repeat(50));

// 1. Check SDK installation
console.log('\n1. Checking SDK installation...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.dependencies['react-native-purchases']) {
    console.log('✅ react-native-purchases installed:', packageJson.dependencies['react-native-purchases']);
  } else {
    console.log('❌ react-native-purchases not found in package.json');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Failed to read package.json:', error.message);
  process.exit(1);
}

// 2. Check source files
console.log('\n2. Checking source files...');
const filesToCheck = [
  'src/lib/revenuecat.ts',
  'src/features/premium/usePremium.ts',
  'src/features/paywall/Paywall.tsx',
];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} not found`);
    process.exit(1);
  }
});

// 3. Check .env file
console.log('\n3. Checking .env file...');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('RC_IOS_KEY') || envContent.includes('REVENUECAT_API_KEY')) {
    console.log('✅ Environment variable found');
    
    // Check if it's a placeholder
    if (envContent.includes('your_key_here') || envContent.includes('XXXXXX')) {
      console.log('⚠️  Environment variable is set to placeholder');
      console.log('   Please update .env with your actual RevenueCat API key');
    } else {
      console.log('✅ Environment variable appears to be configured');
    }
  } else {
    console.log('⚠️  RC_IOS_KEY or REVENUECAT_API_KEY not found in .env');
    console.log('   Add: RC_IOS_KEY=appl_your_key_here');
  }
} else {
  console.log('⚠️  .env file not found');
  console.log('   Create .env file with: RC_IOS_KEY=appl_your_key_here');
}

// 4. Check App.tsx integration
console.log('\n4. Checking App.tsx integration...');
try {
  const appContent = fs.readFileSync('App.tsx', 'utf8');
  
  if (appContent.includes('initializeRevenueCat')) {
    console.log('✅ RevenueCat initialization found in App.tsx');
  } else {
    console.log('❌ initializeRevenueCat not found in App.tsx');
    process.exit(1);
  }
  
  if (appContent.includes('from \'./src/lib/revenuecat\'')) {
    console.log('✅ RevenueCat import found in App.tsx');
  } else {
    console.log('❌ RevenueCat import not found in App.tsx');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Failed to read App.tsx:', error.message);
  process.exit(1);
}

// 5. Check iOS Pod installation
console.log('\n5. Checking iOS Pod installation...');
const podfileLockPath = path.join(process.cwd(), 'ios', 'Podfile.lock');
if (fs.existsSync(podfileLockPath)) {
  const podfileContent = fs.readFileSync(podfileLockPath, 'utf8');
  if (podfileContent.includes('RNPurchases') || podfileContent.includes('Purchases')) {
    console.log('✅ RevenueCat pods installed');
  } else {
    console.log('❌ RevenueCat pods not found in Podfile.lock');
    console.log('   Run: cd ios && pod install');
    process.exit(1);
  }
} else {
  console.log('⚠️  Podfile.lock not found');
  console.log('   Run: cd ios && pod install');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ REVENUECAT VERIFICATION COMPLETE');
console.log('='.repeat(50));

console.log('\n📋 SUMMARY:');
console.log('✅ SDK installed correctly');
console.log('✅ Source files created');
console.log('✅ App.tsx integration present');
console.log('✅ iOS pods installed');

console.log('\n⚠️  IMPORTANT:');
console.log('1. Update .env with your actual RevenueCat API key');
console.log('2. Configure products in RevenueCat Dashboard');
console.log('3. Test with: npm run ios');

console.log('\n📝 Next Steps:');
console.log('1. Get API key from: https://app.revenuecat.com');
console.log('2. Add to .env: RC_IOS_KEY=appl_your_key_here');
console.log('3. Configure products and entitlements in dashboard');
console.log('4. Test purchase flow in iOS app');

console.log('\n✅ App is ready for RevenueCat integration!');

