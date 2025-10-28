// BASIC IAP ROUTES - TEMPORARY VERSION
// Full implementation will be restored after database connection is working

import express from 'express';
// Load shared products via CommonJS wrapper to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { IAP_PRODUCTS, PRODUCT_CONFIG } = require('../../shared/iap/products.cjs');

/**
 * Validate receipt with Apple's VerifyReceipt API
 * PRODUCTION: Use sandbox for testing, production for release
 */
async function validateReceiptWithApple(receiptData: string, productId: string): Promise<boolean> {
  try {
    const url = process.env.NODE_ENV === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': process.env.APPLE_SHARED_SECRET || '',
      }),
    });
    
    const result = await response.json();
    
    if (result.status === 0) {
      // Valid receipt
      console.log('✅ Receipt validated successfully');
      return true;
    } else {
      // Invalid receipt
      console.error('❌ Invalid receipt:', result.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating receipt with Apple:', error);
    return false;
  }
}

const router = express.Router();

// Basic products endpoint
router.get('/products', (req, res) => {
  try {
    const products = Object.values(PRODUCT_CONFIG);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error('❌ Error getting products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get products',
    });
  }
});

// Basic verify endpoint
router.post('/verify', async (req, res) => {
  try {
    const { receiptData, userId, productId } = req.body;

    console.log('🔐 POST /iap/verify - Basic implementation');
    console.log('Receipt:', receiptData?.substring(0, 50) + '...');
    console.log('User ID:', userId);
    console.log('Product ID:', productId);

    // PRODUCTION: Validate receipt with Apple
    const isValid = await validateReceiptWithApple(receiptData, productId);
    
    if (!isValid) {
      console.warn('⚠️ Receipt validation failed, rejecting purchase');
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt - purchase rejected',
      });
    }
    
    res.json({
      success: true,
      entitlements: {
        isPremium: true,
        productId: productId,
        expiresAt: null,
        source: productId?.includes('monthly') ? 'monthly' : (productId?.includes('yearly') ? 'yearly' : 'lifetime'),
      },
    });
  } catch (error) {
    console.error('❌ Error verifying receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify receipt',
    });
  }
});

// Basic entitlements endpoint
router.get('/entitlements/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📊 GET /iap/entitlements - Basic implementation');
    console.log('User ID:', userId);

    // For now, return no entitlements (will be implemented properly later)
    res.json({
      success: true,
      entitlements: {
        isPremium: false,
        source: null,
        expiresAt: null,
      },
    });
  } catch (error) {
    console.error('❌ Error getting entitlements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get entitlements',
    });
  }
});

export default router;
