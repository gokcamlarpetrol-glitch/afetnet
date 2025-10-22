// BASIC IAP ROUTES - TEMPORARY VERSION
// Full implementation will be restored after database connection is working

import express from 'express';

const router = express.Router();

// Basic products endpoint
router.get('/products', (req, res) => {
  try {
    const products = [
      {
        id: 'org.afetnet1.premium.monthly',
        title: 'Aylık Premium',
        description: 'Tüm premium özellikler 1 ay',
        price: 49.99,
        currency: 'TRY',
        type: 'subscription',
      },
      {
        id: 'org.afetnet1.premium.yearly',
        title: 'Yıllık Premium',
        description: 'Tüm premium özellikler 1 yıl (%17 indirim)',
        price: 499.99,
        currency: 'TRY',
        type: 'subscription',
      },
      {
        id: 'org.afetnet1.premium.lifetime',
        title: 'Yaşam Boyu Premium',
        description: 'Tüm premium özellikler kalıcı (%50 indirim)',
        price: 999.99,
        currency: 'TRY',
        type: 'lifetime',
      },
    ];

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

    // For now, always return success (will be implemented properly later)
    res.json({
      success: true,
      entitlements: {
        isPremium: true,
        productId: productId,
        expiresAt: null,
        source: productId?.includes('monthly') ? 'monthly' : 'yearly',
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
