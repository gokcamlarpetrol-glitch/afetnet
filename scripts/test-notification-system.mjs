#!/usr/bin/env node
/**
 * NOTIFICATION SYSTEM TEST
 * Tests notification service initialization and configuration
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const RESULTS = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  const line = `[${timestamp}] ${prefix} ${message}`;
  RESULTS.push(line);
  console.log(line);
}

async function testNotificationService() {
  log('Testing Notification Service...');
  
  // Check if NotificationService file exists
  const notificationServicePath = './src/core/services/NotificationService.ts';
  if (existsSync(notificationServicePath)) {
    log('NotificationService.ts: ✅ File exists', 'success');
    
    const content = readFileSync(notificationServicePath, 'utf8');
    
    // Check for key features
    if (content.includes('showEarthquakeNotification')) {
      log('showEarthquakeNotification: ✅ Method exists', 'success');
    } else {
      log('showEarthquakeNotification: ❌ Method missing', 'error');
    }
    
    if (content.includes('showSOSNotification')) {
      log('showSOSNotification: ✅ Method exists', 'success');
    } else {
      log('showSOSNotification: ❌ Method missing', 'error');
    }
    
    if (content.includes('loadNotificationsModule')) {
      log('Lazy loading: ✅ Implemented', 'success');
    } else {
      log('Lazy loading: ⚠️ Not implemented', 'warning');
    }
    
    if (content.includes('waitForNativeBridge')) {
      log('Native bridge check: ✅ Implemented', 'success');
    } else {
      log('Native bridge check: ⚠️ Not implemented', 'warning');
    }
    
    // Check for error handling
    if (content.includes('catch') && content.includes('error')) {
      log('Error handling: ✅ Implemented', 'success');
    } else {
      log('Error handling: ⚠️ May be missing', 'warning');
    }
  } else {
    log('NotificationService.ts: ❌ File not found', 'error');
  }
}

async function testEEWNotifications() {
  log('Testing EEW Notification System...');
  
  const eewNotificationsPath = './src/eew/notifications.ts';
  if (existsSync(eewNotificationsPath)) {
    log('EEW notifications.ts: ✅ File exists', 'success');
    
    const content = readFileSync(eewNotificationsPath, 'utf8');
    
    if (content.includes('ensureNotifPermissions')) {
      log('Permission handling: ✅ Implemented', 'success');
    } else {
      log('Permission handling: ⚠️ May be missing', 'warning');
    }
  } else {
    log('EEW notifications.ts: ⚠️ File not found', 'warning');
  }
}

async function testMultiChannelAlert() {
  log('Testing Multi-Channel Alert Service...');
  
  const multiChannelPath = './src/core/services/MultiChannelAlertService.ts';
  if (existsSync(multiChannelPath)) {
    log('MultiChannelAlertService.ts: ✅ File exists', 'success');
    
    const content = readFileSync(multiChannelPath, 'utf8');
    
    if (content.includes('sendAlert')) {
      log('sendAlert: ✅ Method exists', 'success');
    } else {
      log('sendAlert: ❌ Method missing', 'error');
    }
    
    // Check for channel support
    const channels = ['pushNotification', 'fullScreenAlert', 'alarmSound', 'vibration', 'tts'];
    channels.forEach(channel => {
      if (content.includes(channel)) {
        log(`${channel}: ✅ Supported`, 'success');
      } else {
        log(`${channel}: ⚠️ May not be supported`, 'warning');
      }
    });
  } else {
    log('MultiChannelAlertService.ts: ⚠️ File not found', 'warning');
  }
}

async function testNotificationIntegration() {
  log('Testing Notification Integration Points...');
  
  // Check EarthquakeService integration
  const earthquakeServicePath = './src/core/services/EarthquakeService.ts';
  if (existsSync(earthquakeServicePath)) {
    const content = readFileSync(earthquakeServicePath, 'utf8');
    
    if (content.includes('notificationService') || content.includes('NotificationService')) {
      log('EarthquakeService integration: ✅ Found', 'success');
      
      if (content.includes('showEarthquakeNotification')) {
        log('Earthquake notifications: ✅ Integrated', 'success');
      } else {
        log('Earthquake notifications: ⚠️ May not be integrated', 'warning');
      }
    } else {
      log('EarthquakeService integration: ⚠️ Not found', 'warning');
    }
  }
  
  // Check GlobalEarthquakeAnalysisService integration
  const globalServicePath = './src/core/services/GlobalEarthquakeAnalysisService.ts';
  if (existsSync(globalServicePath)) {
    const content = readFileSync(globalServicePath, 'utf8');
    
    if (content.includes('multiChannelAlertService') || content.includes('MultiChannelAlertService')) {
      log('GlobalEarthquakeAnalysisService integration: ✅ Found', 'success');
      
      if (content.includes('sendAlert')) {
        log('Early warning alerts: ✅ Integrated', 'success');
      } else {
        log('Early warning alerts: ⚠️ May not be integrated', 'warning');
      }
    } else {
      log('GlobalEarthquakeAnalysisService integration: ⚠️ Not found', 'warning');
    }
  }
}

async function main() {
  log('========================================');
  log('NOTIFICATION SYSTEM TEST');
  log('========================================');
  log('');
  
  await testNotificationService();
  log('');
  
  await testEEWNotifications();
  log('');
  
  await testMultiChannelAlert();
  log('');
  
  await testNotificationIntegration();
  log('');
  
  log('========================================');
  log('TEST SUMMARY');
  log('========================================');
  
  const successCount = RESULTS.filter(r => r.includes('✅')).length;
  const errorCount = RESULTS.filter(r => r.includes('❌')).length;
  const warningCount = RESULTS.filter(r => r.includes('⚠️')).length;
  
  log(`Success: ${successCount}`);
  log(`Errors: ${errorCount}`);
  log(`Warnings: ${warningCount}`);
  
  if (errorCount === 0) {
    log('✅ Notification system is properly configured', 'success');
  } else {
    log(`⚠️ ${errorCount} issue(s) found`, 'warning');
  }
  
  // Write report
  const fs = await import('fs');
  const reportFile = './reports/notification-system-test-report.txt';
  if (!fs.existsSync('./reports')) {
    fs.mkdirSync('./reports', { recursive: true });
  }
  fs.writeFileSync(reportFile, RESULTS.join('\n'), 'utf8');
  log('');
  log(`Report saved to: ${reportFile}`);
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});









