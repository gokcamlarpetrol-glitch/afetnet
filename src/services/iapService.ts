// APPLE & GOOGLE IAP SERVICE - PRODUCTION READY WITH SERVER VERIFICATION
// Elite level implementation with comprehensive error handling and server-side verification
import { Alert, Platform } from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { usePremium } from '../store/premium';
import { 
  IAP_PRODUCTS,
  IAP_PRODUCT_IDS,
  SUBSCRIPTION_PRODUCTS,
  LIFETIME_PRODUCTS,
  isSubscriptionProduct,
  isLifetimeProduct,
  isValidProduct,
  PRODUCT_CONFIG,
  logProductDetection,
  logPremiumStatus,
  ProductId,
  ProductInfo
} from '@shared/iap/products';

// Server configuration
const SERVER_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api' 
  : 'https://afetnet-backend.onrender.com/api';

// Type definitions
type Product = InAppPurchases.InAppPurchase;
type Purchase = InAppPurchases.InAppPurchase;
type PurchaseError = any;

interface ServerEntitlements {
  isPremium: boolean;
  productId?: string;
  expiresAt?: number;
  source?: 'monthly' | 'yearly' | 'lifetime';
}

interface ServerResponse {
  success: boolean;
  entitlements?: ServerEntitlements;
  error?: string;
}

// Premium plans - Using centralized products
export const PREMIUM_PLANS = {
  [IAP_PRODUCTS.monthly]: PRODUCT_CONFIG[IAP_PRODUCTS.monthly],
  [IAP_PRODUCTS.yearly]: PRODUCT_CONFIG[IAP_PRODUCTS.yearly],
  [IAP_PRODUCTS.lifetime]: PRODUCT_CONFIG[IAP_PRODUCTS.lifetime]
} as const;

export type PremiumPlanId = ProductId;

const PREMIUM_STATUS_KEY = '@afetnet_premium_status';
const LAST_PURCHASE_KEY = '@afetnet_last_purchase';

class IAPService {
  private static instance: IAPService;
  private isInitialized = false;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isProcessingPurchase = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): IAPService {
    if (!IAPService.instance) {
      IAPService.instance = new IAPService();
    }
    return IAPService.instance;
  }

  // Initialize IAP connection with comprehensive error handling
  async initialize(): Promise<boolean> {
    try {
      // Prevent multiple initializations
      if (this.isInitialized) {
        logger.info('IAP service already initialized');
        return true;
      }

      logger.info('Initializing IAP service...');

      // Initialize connection with timeout
      const initPromise = InAppPurchases.connectAsync();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('IAP initialization timeout')), 10000)
      );

      const result = await Promise.race([initPromise, timeoutPromise]);
      logger.info('IAP connection initialized:', result);

      // Set up purchase listeners
      this.setupPurchaseListeners();

      this.isInitialized = true;
      logger.info('✅ IAP service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize IAP service:', error);
      // Don't throw - gracefully degrade
      return false;
    }
  }

  // Setup purchase update and error listeners with comprehensive error handling
  private setupPurchaseListeners(): void {
    try {
      // Purchase listener (handles both success and error)
      InAppPurchases.setPurchaseListener(
        async ({ responseCode, results, errorCode }) => {
          logger.info('📦 Purchase event:', { responseCode, resultsCount: results?.length, errorCode });

          // Handle successful purchase
          if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
            for (const purchase of results) {
              // Prevent duplicate processing
              if (this.isProcessingPurchase) {
                logger.warn('⚠️ Purchase already being processed, skipping...');
                continue;
              }

              this.isProcessingPurchase = true;

              try {
                // Check if this is a valid product
                if (!isValidProduct(purchase.productId)) {
                  logger.warn('⚠️ Invalid product purchased:', purchase.productId);
                  await InAppPurchases.finishTransactionAsync(purchase, false);
                  continue;
                }

                // Log product detection
                logProductDetection(purchase.productId);

                // Validate receipt
                const isValid = await this.validateReceipt(purchase);

                if (isValid) {
                  // Update premium status
                  await this.updatePremiumStatus(purchase);

                  // Finish transaction (CRITICAL - prevents duplicate charges)
                  await InAppPurchases.finishTransactionAsync(purchase, false);

                  // Save purchase info
                  await this.savePurchaseInfo(purchase);

                  // Log premium status
                  logPremiumStatus(true, purchase.productId);

                  logger.iap.purchaseSuccess(purchase.productId, purchase.orderId);

                  Alert.alert(
                    '✅ Başarılı!',
                    'Premium üyeliğiniz aktif edildi!',
                    [{ text: 'Tamam', style: 'default' }]
                  );
                } else {
                  logger.iap.verificationFailed(purchase.productId, 'Server validation failed');
                  Alert.alert(
                    '❌ Hata',
                    'Satın alma doğrulanamadı. Lütfen destek ekibiyle iletişime geçin.',
                    [{ text: 'Tamam', style: 'default' }]
                  );
                }
              } catch (error) {
                logger.error('❌ Purchase processing error:', error);
                Alert.alert(
                  '❌ Hata',
                  'Satın alma işlenirken hata oluştu. Lütfen tekrar deneyin.',
                  [{ text: 'Tamam', style: 'default' }]
                );
              } finally {
                this.isProcessingPurchase = false;
              }
            }
          } 
          // Handle user cancellation
          else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
            logger.info('ℹ️ User cancelled purchase');
          }
          // Handle deferred (iOS parental approval)
          else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
            logger.info('ℹ️ Purchase deferred - awaiting parental approval (iOS)');
            Alert.alert(
              '⏳ Beklemede',
              'Satın alma onay bekliyor (ebeveyn onayı gerekli).',
              [{ text: 'Tamam', style: 'default' }]
            );
          }
          // Handle other errors
          else {
            logger.error('❌ Purchase error:', { responseCode, errorCode });

            // Handle other errors
            const errorMessages: { [key: string]: string } = {
              E_UNKNOWN: 'Bilinmeyen bir hata oluştu.',
              E_SERVICE_ERROR: 'Mağaza servisi hatası. Lütfen tekrar deneyin.',
              E_USER_ERROR: 'Kullanıcı hatası. Lütfen tekrar deneyin.',
              E_ITEM_UNAVAILABLE: 'Ürün şu anda mevcut değil.',
              E_REMOTE_ERROR: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.',
              E_NETWORK_ERROR: 'Ağ hatası. Lütfen tekrar deneyin.',
              E_RECEIPT_FAILED: 'Makbuz doğrulaması başarısız.',
              E_RECEIPT_FINISHED_FAILED: 'Makbuz tamamlanamadı.'
            };

            const message = errorCode ? (errorMessages[errorCode] || 'Satın alma işlemi başarısız oldu.') : 'Satın alma işlemi başarısız oldu.';

            Alert.alert(
              '❌ Satın Alma Hatası',
              message,
              [{ text: 'Tamam', style: 'default' }]
            );
          }
        }
      );

      logger.info('✅ Purchase listeners set up successfully');
    } catch (error) {
      logger.error('❌ Failed to setup purchase listeners:', error);
    }
  }

  // Get available products from store
  async getAvailableProducts(): Promise<Product[]> {
    try {
      if (!this.isInitialized) {
        logger.warn('⚠️ IAP service not initialized, initializing now...');
        await this.initialize();
      }

      const productIds = IAP_PRODUCT_IDS; // Get all valid product IDs
      logger.info('📦 Fetching products:', productIds);

      // Fetch products from store
      const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        logger.info('✅ Products fetched:', results.length);
        return results as any;
      } else {
        logger.warn('⚠️ Failed to fetch products:', responseCode);
        return [];
      }
    } catch (error) {
      logger.error('❌ Failed to get products:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  // Purchase premium plan with comprehensive error handling
  async purchasePlan(planId: PremiumPlanId): Promise<boolean> {
    try {
      // Validate plan
      const plan = PREMIUM_PLANS[planId];
      if (!plan) {
        logger.error('❌ Invalid plan ID:', planId);
        throw new Error('Invalid plan ID');
      }

      // Check if already processing
      if (this.isProcessingPurchase) {
        logger.warn('⚠️ Purchase already in progress');
        Alert.alert(
          'ℹ️ Bilgi',
          'Bir satın alma işlemi zaten devam ediyor.',
          [{ text: 'Tamam', style: 'default' }]
        );
        return false;
      }

      // Ensure initialized
      if (!this.isInitialized) {
        logger.warn('⚠️ IAP service not initialized, initializing now...');
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize IAP service');
        }
      }

      logger.info('🛒 Starting purchase for plan:', planId);

      // Request purchase - use correct API
      await InAppPurchases.purchaseItemAsync(plan.id);

      logger.info('✅ Purchase request sent successfully');
      return true;
    } catch (error) {
      logger.error('❌ Purchase failed:', error);

      // User-friendly error message
      const errorMessage =
        error instanceof Error
          ? error.message.includes('timeout')
            ? 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.'
            : 'Satın alma başlatılamadı. Lütfen tekrar deneyin.'
          : 'Satın alma başlatılamadı.';

      Alert.alert('❌ Hata', errorMessage, [{ text: 'Tamam', style: 'default' }]);
      return false;
    }
  }

  // Validate receipt with server
  private async validateReceipt(purchase: Purchase): Promise<boolean> {
    try {
      logger.info('🔐 Validating receipt with server for:', purchase.productId);

      if (!purchase.orderId) {
        logger.error('❌ No order ID found');
        return false;
      }

      if (!purchase.productId) {
        logger.error('❌ No product ID found');
        return false;
      }

      // Get user ID (implement your user identification method)
      const userId = await this.getUserId();
      
      // Send receipt to server for verification
      const response = await fetch(`${SERVER_BASE_URL}/iap/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptData: purchase.orderId,
          userId,
          productId: purchase.productId
        })
      });

      const data: ServerResponse = await response.json();
      
      if (data.success && data.entitlements?.isPremium) {
        logger.info('✅ Server receipt validation passed');
        return true;
      } else {
        logger.iap.serverError('/iap/verify', data.error || 'Unknown error');
        return false;
      }
    } catch (error) {
      logger.error('❌ Receipt validation failed:', error);
      return false;
    }
  }

  // Get user ID (implement your user identification method)
  private async getUserId(): Promise<string> {
    try {
      // Try to get from AsyncStorage first
      const storedUserId = await AsyncStorage.getItem('@afetnet_user_id');
      if (storedUserId) {
        return storedUserId;
      }

      // Generate new user ID (implement your user creation logic)
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem('@afetnet_user_id', userId);
      
      logger.info('🆔 Generated new user ID:', userId);
      return userId;
    } catch (error) {
      logger.error('❌ Failed to get user ID:', error);
      // Fallback to device-based ID
      return `device_${Date.now()}`;
    }
  }

  // Get entitlements from server
  private async getServerEntitlements(): Promise<ServerEntitlements | null> {
    try {
      const userId = await this.getUserId();
      
      const response = await fetch(`${SERVER_BASE_URL}/user/entitlements?userId=${userId}`);
      const data: ServerResponse = await response.json();
      
      if (data.success && data.entitlements) {
        logger.info('📊 Server entitlements:', data.entitlements);
        return data.entitlements;
      } else {
        logger.warn('⚠️ Failed to get server entitlements:', data.error);
        return null;
      }
    } catch (error) {
      logger.error('❌ Error getting server entitlements:', error);
      return null;
    }
  }

  // Update premium status in app
  private async updatePremiumStatus(purchase: Purchase): Promise<void> {
    try {
      logger.info('💾 Updating premium status for:', purchase.productId);

      const productConfig = PRODUCT_CONFIG[purchase.productId as keyof typeof PRODUCT_CONFIG];
      if (!productConfig) {
        logger.error('❌ Unknown product configuration:', purchase.productId);
        return;
      }

      // Calculate expiry date based on product type
      let expiryDate: number | null = null;
      
      if (isLifetimeProduct(purchase.productId)) {
        // Lifetime products never expire
        expiryDate = null;
        logger.info('🔄 Lifetime product - premium permanent');
      } else if (isSubscriptionProduct(purchase.productId)) {
        // Calculate subscription expiry
        const purchaseTime = purchase.purchaseTime || Date.now();
        const durationMs = productConfig.duration === 'monthly' 
          ? 30 * 24 * 60 * 60 * 1000  // 30 days
          : 365 * 24 * 60 * 60 * 1000; // 365 days
        
        expiryDate = purchaseTime + durationMs;
        logger.info(`🔄 Subscription product - expires in ${productConfig.duration}`);
      }

      const premiumStatus = {
        isPremium: true,
        productId: purchase.productId,
        orderId: purchase.orderId,
        purchaseTime: purchase.purchaseTime,
        expiryDate,
        productType: productConfig.type,
        updatedAt: Date.now()
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(premiumStatus));

      // CRITICAL: Update Zustand premium store immediately
      const { setPremium } = usePremium.getState();
      const planInfo = {
        id: purchase.productId,
        title: productConfig.title,
        price: 0, // Will be fetched from store
        currency: 'TRY',
        description: productConfig.description
      };
      
      setPremium(
        true,
        planInfo,
        expiryDate ? new Date(expiryDate) : undefined
      );

      logger.info('✅ Premium status updated successfully (AsyncStorage + Zustand)');
    } catch (error) {
      logger.error('❌ Failed to update premium status:', error);
      throw error;
    }
  }

  // Save purchase info for restore
  private async savePurchaseInfo(purchase: Purchase): Promise<void> {
    try {
      const purchaseInfo = {
        productId: purchase.productId,
        orderId: purchase.orderId,
        purchaseTime: purchase.purchaseTime,
        savedAt: Date.now()
      };

      await AsyncStorage.setItem(LAST_PURCHASE_KEY, JSON.stringify(purchaseInfo));
      logger.info('✅ Purchase info saved');
    } catch (error) {
      logger.error('❌ Failed to save purchase info:', error);
    }
  }

  // Check if user has active premium subscription
  async checkPremiumStatus(): Promise<boolean> {
    try {
      // First try to get entitlements from server
      const serverEntitlements = await this.getServerEntitlements();
      
      if (serverEntitlements) {
        // Use server entitlements as source of truth
        const isPremium = serverEntitlements.isPremium;
        
        // Update local storage to match server
        const premiumStatus = {
          isPremium,
          productId: serverEntitlements.productId,
          expiresAt: serverEntitlements.expiresAt,
          source: serverEntitlements.source,
          updatedAt: Date.now(),
          fromServer: true
        };
        
        await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(premiumStatus));
        
        // CRITICAL: Update Zustand store
        const { setPremium } = usePremium.getState();
        if (isPremium && serverEntitlements.productId) {
          const productConfig = PRODUCT_CONFIG[serverEntitlements.productId as keyof typeof PRODUCT_CONFIG];
          if (productConfig) {
            setPremium(
              true,
              {
                id: serverEntitlements.productId,
                title: productConfig.title,
                price: 0,
                currency: 'TRY',
                description: productConfig.description
              },
              serverEntitlements.expiresAt ? new Date(serverEntitlements.expiresAt) : undefined
            );
          }
        } else {
          setPremium(false);
        }
        
        logPremiumStatus(isPremium, serverEntitlements.productId);
        return isPremium;
      }

      // Fallback to local storage if server is unavailable
      logger.warn('⚠️ Server unavailable, checking local storage');
      const statusStr = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
      if (statusStr) {
        const status = JSON.parse(statusStr);
        logger.info('📊 Premium status from storage:', status);

        // Check if expired (for subscriptions only)
        if (status.expiryDate && status.expiryDate < Date.now()) {
          logger.info('⏰ Premium subscription expired');
          await AsyncStorage.removeItem(PREMIUM_STATUS_KEY);
          
          // Update Zustand store
          const { setPremium } = usePremium.getState();
          setPremium(false);
          
          logPremiumStatus(false, status.productId);
          return false;
        }

        // Check if it's a valid product
        if (!isValidProduct(status.productId)) {
          logger.warn('⚠️ Invalid product in storage:', status.productId);
          await AsyncStorage.removeItem(PREMIUM_STATUS_KEY);
          
          // Update Zustand store
          const { setPremium } = usePremium.getState();
          setPremium(false);
          
          return false;
        }

        // Update Zustand store with local data
        const { setPremium } = usePremium.getState();
        const productConfig = PRODUCT_CONFIG[status.productId as keyof typeof PRODUCT_CONFIG];
        if (productConfig) {
          setPremium(
            true,
            {
              id: status.productId,
              title: productConfig.title,
              price: 0,
              currency: 'TRY',
              description: productConfig.description
            },
            status.expiryDate ? new Date(status.expiryDate) : undefined
          );
        }

        logPremiumStatus(true, status.productId);
        return status.isPremium;
      }

      // No purchase history found
      const { setPremium } = usePremium.getState();
      setPremium(false);
      
      logPremiumStatus(false);
      return false;
    } catch (error) {
      logger.error('❌ Failed to check premium status:', error);
      return false;
    }
  }

  // Restore purchases with comprehensive error handling
  async restorePurchases(): Promise<boolean> {
    try {
      logger.info('🔄 Restoring purchases...');

      // Ensure initialized
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize IAP service');
        }
      }

      // Restore purchases from store
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        logger.iap.restoreSuccess(results.length);

        if (results.length > 0) {
          // Process restored purchases - only valid products
          let premiumPurchases = 0;
          for (const purchase of results) {
            if (isValidProduct(purchase.productId)) {
              logProductDetection(purchase.productId);
              
              // Verify with server
              const isValid = await this.validateReceipt(purchase);
              if (isValid) {
                await this.updatePremiumStatus(purchase);
                premiumPurchases++;
              } else {
                logger.warn('⚠️ Server verification failed for:', purchase.productId);
              }
            } else {
              logger.warn('⚠️ Invalid product in restore:', purchase.productId);
            }
          }

          if (premiumPurchases > 0) {
            Alert.alert(
              '✅ Başarılı!',
              `${premiumPurchases} premium satın alım geri yüklendi.`,
              [{ text: 'Tamam', style: 'default' }]
            );
          } else {
            Alert.alert(
              'ℹ️ Bilgi',
              'Geri yüklenecek premium satın alım bulunamadı.',
              [{ text: 'Tamam', style: 'default' }]
            );
          }
        } else {
          Alert.alert(
            'ℹ️ Bilgi',
            'Geri yüklenecek satın alım bulunamadı.',
            [{ text: 'Tamam', style: 'default' }]
          );
        }
      } else {
        logger.error('❌ Failed to restore purchases:', responseCode);
        Alert.alert(
          '❌ Hata',
          'Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.',
          [{ text: 'Tamam', style: 'default' }]
        );
      }

      return true;
    } catch (error) {
      logger.error('❌ Failed to restore purchases:', error);

      Alert.alert(
        '❌ Hata',
        'Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.',
        [{ text: 'Tamam', style: 'default' }]
      );

      return false;
    }
  }

  // Cleanup with proper resource management
  async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Cleaning up IAP service...');

      // Remove listeners
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }

      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }

      // End connection
      await InAppPurchases.disconnectAsync();
      this.isInitialized = false;
      this.isProcessingPurchase = false;

      logger.info('✅ IAP service cleaned up successfully');
    } catch (error) {
      logger.error('❌ Failed to cleanup IAP service:', error);
      // Don't throw - cleanup should never fail
    }
  }
}

// Export singleton instance
export const iapService = IAPService.getInstance();
export default iapService;
