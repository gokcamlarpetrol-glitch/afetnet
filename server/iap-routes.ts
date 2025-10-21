// SERVER-SIDE IAP VERIFICATION SYSTEM WITH DATABASE
// Apple App Store receipt validation and entitlement management with PostgreSQL

import express from 'express';
import crypto from 'crypto';
import { IAP_PRODUCTS, IAP_PRODUCT_IDS, isSubscriptionProduct, isLifetimeProduct } from './products';
import { db, User, Purchase, Entitlement } from './database';

const router = express.Router();

// Apple App Store verification URLs
const APPLE_VERIFY_URLS = {
  sandbox: 'https://sandbox.itunes.apple.com/verifyReceipt',
  production: 'https://buy.itunes.apple.com/verifyReceipt'
};

// GET /iap/products - Return only valid product IDs
router.get('/products', (req, res) => {
  try {
    console.log('📦 GET /iap/products - Returning valid products');
    
    const products = IAP_PRODUCT_IDS.map(productId => ({
      id: productId,
      title: getProductTitle(productId),
      description: getProductDescription(productId),
      price: getProductPrice(productId),
      currency: 'TRY',
      type: isSubscriptionProduct(productId) ? 'subscription' : 'lifetime'
    }));

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('❌ Error getting products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get products'
    });
  }
});

// POST /iap/verify - Verify Apple receipt and set entitlements
router.post('/verify', async (req, res) => {
  try {
    const { receiptData, userId, productId, email } = req.body;
    
    console.log('🔐 POST /iap/verify - Verifying receipt for user:', userId);
    
    if (!receiptData || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: receiptData, productId'
      });
    }

    // Validate product ID
    if (!IAP_PRODUCT_IDS.includes(productId)) {
      console.error('❌ Invalid product ID:', productId);
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    // Verify receipt with Apple
    const verificationResult = await verifyReceiptWithApple(receiptData);
    
    if (!verificationResult.valid) {
      console.error('❌ Receipt verification failed:', verificationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Receipt verification failed'
      });
    }

    // Extract transaction info
    const transaction = verificationResult.transaction;
    if (!transaction) {
      return res.status(400).json({
        success: false,
        error: 'No valid transaction found'
      });
    }

    // Get or create user
    const userEmail = email || `user_${userId}@afetnet.com`;
    const user = await db.getOrCreateUser(userEmail, userId);

    // Check if purchase already exists
    const existingPurchase = await db.getPurchaseByTransactionId(transaction.transactionId);
    if (existingPurchase && existingPurchase.status === 'active') {
      console.log('ℹ️ Purchase already exists and is active:', transaction.transactionId);
      const entitlements = await db.getUserEntitlements(user.id);
      
      return res.json({
        success: true,
        entitlements: {
          isPremium: entitlements?.is_premium || false,
          productId: entitlements?.active_product_id,
          expiresAt: entitlements?.expires_at?.getTime(),
          source: entitlements?.source
        }
      });
    }

    // Calculate expiry date
    let expiresAt: Date | undefined;
    let isLifetime = false;
    
    if (isLifetimeProduct(productId)) {
      isLifetime = true;
      expiresAt = undefined; // Never expires
    } else if (isSubscriptionProduct(productId)) {
      const durationMs = productId.includes('monthly') 
        ? 30 * 24 * 60 * 60 * 1000  // 30 days
        : 365 * 24 * 60 * 60 * 1000; // 365 days
      expiresAt = new Date(transaction.purchaseDate + durationMs);
    }

    // Create purchase record
    const purchase = await db.createPurchase(
      user.id,
      productId,
      transaction.originalTransactionId,
      transaction.transactionId,
      new Date(transaction.purchaseDate),
      expiresAt,
      isLifetime
    );

    // Get updated entitlements (trigger will update automatically)
    const entitlements = await db.getUserEntitlements(user.id);
    
    console.log('✅ Purchase created and entitlements updated:', {
      userId: user.id,
      productId,
      isLifetime,
      expiresAt: expiresAt?.toISOString()
    });

    res.json({
      success: true,
      entitlements: {
        isPremium: entitlements?.is_premium || false,
        productId: entitlements?.active_product_id,
        expiresAt: entitlements?.expires_at?.getTime(),
        source: entitlements?.source
      }
    });

  } catch (error) {
    console.error('❌ Error verifying receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /user/entitlements - Get user entitlements
router.get('/user/entitlements', async (req, res) => {
  try {
    const { userId, email } = req.query;
    
    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or email parameter'
      });
    }

    // Get or create user
    const userEmail = email as string || `user_${userId}@afetnet.com`;
    const user = await db.getOrCreateUser(userEmail, userId as string);

    // Get entitlements from database
    const entitlements = await db.getUserEntitlements(user.id);
    
    if (!entitlements) {
      return res.json({
        success: true,
        entitlements: {
          isPremium: false,
          source: null,
          expiresAt: null
        }
      });
    }

    console.log('📊 GET /user/entitlements - User:', user.id, {
      isPremium: entitlements.is_premium,
      source: entitlements.source,
      expiresAt: entitlements.expires_at?.toISOString() || 'never'
    });

    res.json({
      success: true,
      entitlements: {
        isPremium: entitlements.is_premium,
        source: entitlements.source,
        expiresAt: entitlements.expires_at?.getTime()
      }
    });

  } catch (error) {
    console.error('❌ Error getting entitlements:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /iap/apple-notifications - Apple Server Notifications V2 webhook
router.post('/apple-notifications', async (req, res) => {
  try {
    const notification = req.body;
    
    console.log('🔔 Apple Server Notification received:', notification.notificationType);
    
    // Verify the notification signature (implement proper verification)
    // For now, we'll process the notification
    
    const { notificationType, data } = notification;
    
    switch (notificationType) {
      case 'RENEWAL':
        await handleRenewal(data);
        break;
      case 'EXPIRED':
        await handleExpired(data);
        break;
      case 'REFUND':
        await handleRefund(data);
        break;
      case 'REVOKE':
        await handleRevoke(data);
        break;
      default:
        console.log('ℹ️ Unhandled notification type:', notificationType);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing Apple notification:', error);
    res.status(500).send('Error');
  }
});

// Helper functions
async function verifyReceiptWithApple(receiptData: string): Promise<{
  valid: boolean;
  transaction?: any;
  error?: string;
}> {
  try {
    // Try production first
    let response = await fetch(APPLE_VERIFY_URLS.production, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': process.env.APPLE_SHARED_SECRET, // Set this in your environment
        'exclude-old-transactions': true
      })
    });

    let result: any = await response.json();
    
    // If production fails with 21007, try sandbox
    if (result.status === 21007) {
      console.log('🔄 Production failed, trying sandbox...');
      response = await fetch(APPLE_VERIFY_URLS.sandbox, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': process.env.APPLE_SHARED_SECRET,
          'exclude-old-transactions': true
        })
      });
      result = await response.json();
    }

    if (result.status === 0) {
      // Success - extract transaction info
      const latestReceiptInfo = result.latest_receipt_info;
      if (latestReceiptInfo && latestReceiptInfo.length > 0) {
        const transaction = latestReceiptInfo[latestReceiptInfo.length - 1];
        return {
          valid: true,
          transaction: {
            productId: transaction.product_id,
            purchaseDate: transaction.purchase_date_ms,
            transactionId: transaction.transaction_id,
            originalTransactionId: transaction.original_transaction_id
          }
        };
      }
    }

    return {
      valid: false,
      error: `Apple verification failed with status: ${result.status}`
    };

  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error}`
    };
  }
}

async function handleRenewal(data: any) {
  console.log('🔄 Handling renewal for transaction:', data.transactionId);
  
  try {
    // Find the purchase by transaction ID
    const purchase = await db.getPurchaseByTransactionId(data.transactionId);
    if (!purchase) {
      console.warn('⚠️ Purchase not found for renewal:', data.transactionId);
      return;
    }

    // Update purchase status to active and extend expiry
    const newExpiryDate = data.expiresDate ? new Date(data.expiresDate) : undefined;
    await db.updatePurchaseStatus(data.transactionId, 'active', data);
    
    console.log('✅ Renewal processed for user:', purchase.user_id);
  } catch (error) {
    console.error('❌ Error handling renewal:', error);
  }
}

async function handleExpired(data: any) {
  console.log('⏰ Handling expiration for transaction:', data.transactionId);
  
  try {
    await db.updatePurchaseStatus(data.transactionId, 'expired', data);
    console.log('✅ Expiration processed for transaction:', data.transactionId);
  } catch (error) {
    console.error('❌ Error handling expiration:', error);
  }
}

async function handleRefund(data: any) {
  console.log('💰 Handling refund for transaction:', data.transactionId);
  
  try {
    await db.updatePurchaseStatus(data.transactionId, 'refunded', data);
    console.log('✅ Refund processed for transaction:', data.transactionId);
  } catch (error) {
    console.error('❌ Error handling refund:', error);
  }
}

async function handleRevoke(data: any) {
  console.log('🚫 Handling revocation for transaction:', data.transactionId);
  
  try {
    await db.updatePurchaseStatus(data.transactionId, 'revoked', data);
    console.log('✅ Revocation processed for transaction:', data.transactionId);
  } catch (error) {
    console.error('❌ Error handling revocation:', error);
  }
}

function getProductTitle(productId: string): string {
  switch (productId) {
    case IAP_PRODUCTS.monthly: return 'Aylık Premium';
    case IAP_PRODUCTS.yearly: return 'Yıllık Premium';
    case IAP_PRODUCTS.lifetime: return 'Yaşam Boyu Premium';
    default: return 'Premium';
  }
}

function getProductDescription(productId: string): string {
  switch (productId) {
    case IAP_PRODUCTS.monthly: return 'Tüm premium özellikler 1 ay';
    case IAP_PRODUCTS.yearly: return 'Tüm premium özellikler 1 yıl (%17 indirim)';
    case IAP_PRODUCTS.lifetime: return 'Tüm premium özellikler kalıcı (%50 indirim)';
    default: return 'Premium özellikler';
  }
}

function getProductPrice(productId: string): number {
  switch (productId) {
    case IAP_PRODUCTS.monthly: return 49.99;
    case IAP_PRODUCTS.yearly: return 499.99;
    case IAP_PRODUCTS.lifetime: return 999.99;
    default: return 0;
  }
}

export default router;
