#!/usr/bin/env node

/**
 * ASSN V2 Webhook Testing Script
 * Tests Apple Server Notifications V2 webhook endpoints
 */

const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const WEBHOOK_ENDPOINT = `${SERVER_URL}/api/iap/apple-notifications`;

// Test webhook payloads
const webhookTests = [
  {
    name: 'RENEWAL Event',
    payload: {
      notificationType: 'RENEWAL',
      data: {
        transactionId: 'test_renewal_123',
        expiresDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
        originalTransactionId: 'test_original_123',
        productId: 'org.afetnet1.premium.monthly',
      },
    },
  },
  {
    name: 'DID_CHANGE_RENEWAL_STATUS Event',
    payload: {
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      data: {
        transactionId: 'test_status_change_123',
        originalTransactionId: 'test_original_123',
        productId: 'org.afetnet1.premium.yearly',
        autoRenewStatus: 'true',
      },
    },
  },
  {
    name: 'EXPIRED Event',
    payload: {
      notificationType: 'EXPIRED',
      data: {
        transactionId: 'test_expired_123',
        originalTransactionId: 'test_original_123',
        productId: 'org.afetnet1.premium.monthly',
      },
    },
  },
  {
    name: 'REFUND Event',
    payload: {
      notificationType: 'REFUND',
      data: {
        transactionId: 'test_refund_123',
        originalTransactionId: 'test_original_123',
        productId: 'org.afetnet1.premium.lifetime',
      },
    },
  },
];

async function testWebhook(testCase) {
  console.log(`\n🧪 Testing ${testCase.name}...`);
  
  try {
    const response = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.payload),
    });
    
    if (response.ok) {
      console.log(`✅ ${testCase.name}: SUCCESS (${response.status})`);
      return true;
    } else {
      console.log(`❌ ${testCase.name}: FAILED (${response.status})`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
    return false;
  }
}

async function testServerHealth() {
  console.log('🏥 Testing server health...');
  
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    if (response.ok) {
      const health = await response.json();
      console.log(`✅ Server healthy: ${health.status}`);
      console.log(`   Database: ${health.database}`);
      return true;
    } else {
      console.log(`❌ Server unhealthy: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server unreachable: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔔 ASSN V2 Webhook Testing');
  console.log('==========================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Webhook Endpoint: ${WEBHOOK_ENDPOINT}`);
  
  // Test server health first
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server is not healthy. Please start the server first:');
    console.log('   cd server && npm run dev');
    process.exit(1);
  }
  
  // Run webhook tests
  let passedTests = 0;
  let totalTests = webhookTests.length;
  
  for (const testCase of webhookTests) {
    const passed = await testWebhook(testCase);
    if (passed) passedTests++;
  }
  
  // Results
  console.log('\n📊 Webhook Test Results');
  console.log('========================');
  console.log(`Passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All webhook tests passed!');
    console.log('\n✅ Webhook endpoints are ready for production');
  } else {
    console.log('❌ Some webhook tests failed');
    console.log('\n🔧 Check server logs and webhook implementation');
    process.exit(1);
  }
}

main().catch(console.error);
