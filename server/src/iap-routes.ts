// BASIC IAP ROUTES - TEMPORARY VERSION
// Full implementation will be restored after database connection is working

import express from 'express';
// Load shared products via CommonJS wrapper to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { IAP_PRODUCTS, PRODUCT_CONFIG } = require('../../shared/iap/products.cjs');

/**
 * Validate receipt with Apple's VerifyReceipt API
 * FOLLOWS APPLE'S RECOMMENDED APPROACH:
 * 1. Always try production first
 * 2. If status 21007 (sandbox receipt in production), retry with sandbox
 * 3. This handles the case where production-signed app gets sandbox receipts during testing
 */
interface AppleReceiptResponse {
  status: number;
  receipt?: {
    in_app?: Array<{
      product_id: string;
      transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
  };
  environment?: 'Production' | 'Sandbox';
}

async function validateReceiptWithApple(
  receiptData: string, 
  productId: string
): Promise<{
  isValid: boolean;
  isPremium: boolean;
  expiresAt?: number;
  environment: 'production' | 'sandbox';
}> {
  const sharedSecret = process.env.APPLE_SHARED_SECRET || '';
  
  if (!sharedSecret) {
    console.error('❌ APPLE_SHARED_SECRET not configured');
    return { isValid: false, isPremium: false, environment: 'production' };
  }

  // Step 1: Try production first (Apple's recommendation)
  try {
    const prodResponse = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': sharedSecret,
        'exclude-old-transactions': false,
      }),
    });

    const prodResult: AppleReceiptResponse = await prodResponse.json();

    // Status 0 = success
    if (prodResult.status === 0) {
      console.log('✅ Receipt validated successfully (PRODUCTION)');
      
      // Check if product is in receipt
      const inAppPurchases = prodResult.receipt?.in_app || [];
      const hasProduct = inAppPurchases.some(
        (purchase) => purchase.product_id === productId
      );

      let expiresAt: number | undefined;
      if (hasProduct) {
        const purchase = inAppPurchases.find((p) => p.product_id === productId);
        expiresAt = purchase?.expires_date_ms 
          ? parseInt(purchase.expires_date_ms, 10) 
          : undefined;
      }

      return {
        isValid: true,
        isPremium: hasProduct,
        expiresAt,
        environment: 'production',
      };
    }

    // Status 21007 = Sandbox receipt used in production environment
    // This is expected during testing - retry with sandbox
    if (prodResult.status === 21007) {
      console.log('⚠️ Sandbox receipt detected, retrying with sandbox environment...');
      
      // Step 2: Retry with sandbox
      const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': false,
        }),
      });

      const sandboxResult: AppleReceiptResponse = await sandboxResponse.json();

      if (sandboxResult.status === 0) {
        console.log('✅ Receipt validated successfully (SANDBOX)');
        
        const inAppPurchases = sandboxResult.receipt?.in_app || [];
        const hasProduct = inAppPurchases.some(
          (purchase) => purchase.product_id === productId
        );

        let expiresAt: number | undefined;
        if (hasProduct) {
          const purchase = inAppPurchases.find((p) => p.product_id === productId);
          expiresAt = purchase?.expires_date_ms 
            ? parseInt(purchase.expires_date_ms, 10) 
            : undefined;
        }

        return {
          isValid: true,
          isPremium: hasProduct,
          expiresAt,
          environment: 'sandbox',
        };
      } else {
        console.error('❌ Invalid sandbox receipt:', sandboxResult.status);
        return {
          isValid: false,
          isPremium: false,
          environment: 'sandbox',
        };
      }
    } else {
      // Other error status codes
      console.error('❌ Invalid receipt (production):', prodResult.status);
      return {
        isValid: false,
        isPremium: false,
        environment: 'production',
      };
    }
  } catch (error) {
    console.error('❌ Error validating receipt with Apple:', error);
    return {
      isValid: false,
      isPremium: false,
      environment: 'production',
    };
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

// Receipt validation endpoint - FOLLOWS APPLE'S RECOMMENDED APPROACH
router.post('/verify', async (req, res) => {
  try {
    const { receiptData, userId, productId } = req.body;

    // Validate input
    if (!receiptData || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: receiptData and productId are required',
      });
    }

    console.log('🔐 POST /iap/verify - Receipt validation');
    console.log('User ID:', userId || 'anonymous');
    console.log('Product ID:', productId);
    console.log('Receipt length:', receiptData.length);

    // Validate receipt with Apple (production first, then sandbox if needed)
    const validationResult = await validateReceiptWithApple(receiptData, productId);
    
    if (!validationResult.isValid) {
      console.warn('⚠️ Receipt validation failed, rejecting purchase');
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt - purchase rejected',
        environment: validationResult.environment,
      });
    }

    if (!validationResult.isPremium) {
      console.warn('⚠️ Receipt valid but product not found in receipt');
      return res.status(400).json({
        success: false,
        error: 'Product not found in receipt',
        environment: validationResult.environment,
      });
    }

    // Determine source (monthly/yearly/lifetime)
    let source: 'monthly' | 'yearly' | 'lifetime' = 'monthly';
    if (productId.includes('yearly')) {
      source = 'yearly';
    } else if (productId.includes('lifetime')) {
      source = 'lifetime';
    }

    console.log('✅ Receipt validated successfully');
    console.log('Environment:', validationResult.environment);
    console.log('Product ID:', productId);
    console.log('Source:', source);
    console.log('Expires at:', validationResult.expiresAt ? new Date(validationResult.expiresAt).toISOString() : 'Never (lifetime)');

    res.json({
      success: true,
      entitlements: {
        isPremium: true,
        productId: productId,
        expiresAt: validationResult.expiresAt || null,
        source: source,
        environment: validationResult.environment,
      },
    });
  } catch (error) {
    console.error('❌ Error verifying receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify receipt',
      details: error instanceof Error ? error.message : 'Unknown error',
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
