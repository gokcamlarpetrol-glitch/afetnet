import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import Stripe from 'stripe';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { sendMulticastNotification } from '../services/firebase';
import { prisma } from '../utils/prisma';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

// POST /api/payments/create-payment-intent - Create payment intent
router.post(
  '/create-payment-intent',
  authenticate,
  [
    body('plan')
      .trim()
      .notEmpty().withMessage('Plan is required')
      .isIn(['monthly', 'yearly', 'lifetime']).withMessage('Invalid plan'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { plan } = req.body;

      // CRITICAL: Validate plan and amounts
      const amounts = {
        monthly: 4999, // 49.99 TL
        yearly: 34999, // 349.99 TL
        lifetime: 59999, // 599.99 TL
      };

      const amount = amounts[plan as keyof typeof amounts];

      if (!amount) {
        return res.status(400).json({ error: 'Invalid plan' });
      }

      // CRITICAL: Check if user already has active premium
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { isPremium: true, premiumExpiry: true },
      });

      if (user?.isPremium && user.premiumExpiry && user.premiumExpiry > new Date()) {
        return res.status(400).json({
          error: 'Already premium',
          message: `Your premium subscription is active until ${user.premiumExpiry.toISOString()}`,
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'try',
        metadata: {
          userId: req.user!.id,
          afnId: req.user!.afnId,
          plan,
        },
        description: `AfetNet Premium - ${plan} plan`,
      });

      console.log(`💳 Payment intent created: ${paymentIntent.id} for ${req.user!.afnId}`);

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount,
        currency: 'try',
      });
    } catch (error) {
      console.error('❌ Payment intent creation error:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  }
);

// POST /api/payments/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;

    // CRITICAL: Verify webhook signature
    if (!sig) {
      console.error('❌ CRITICAL: Webhook signature missing');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ CRITICAL: STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify and construct event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`❌ CRITICAL: Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`📨 Webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, plan } = paymentIntent.metadata;

        if (!userId || !plan) {
          console.error('❌ CRITICAL: Missing metadata in payment intent');
          break;
        }

        // CRITICAL: Calculate expiry based on plan
        let premiumExpiry: Date;
        if (plan === 'monthly') {
          premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        } else if (plan === 'yearly') {
          premiumExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        } else if (plan === 'lifetime') {
          premiumExpiry = new Date('2099-12-31');
        } else {
          console.error(`❌ CRITICAL: Invalid plan: ${plan}`);
          break;
        }

        // CRITICAL: Update user premium status
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            isPremium: true,
            premiumExpiry,
            stripeCustomerId: paymentIntent.customer as string,
          },
          include: {
            fcmTokens: true,
          },
        });

        // CRITICAL: Save payment record
        await prisma.payment.create({
          data: {
            userId,
            stripePaymentId: paymentIntent.id,
            stripeCustomerId: paymentIntent.customer as string,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            plan,
            status: 'completed',
            metadata: paymentIntent.metadata as any,
          },
        });

        // Send push notification
        if (updatedUser.fcmTokens.length > 0) {
          const tokens = updatedUser.fcmTokens.map((t: { token: string }) => t.token);
          sendMulticastNotification(tokens, {
            title: '🎉 Premium Aktif!',
            body: `${plan} planınız başarıyla aktif edildi!`,
            data: {
              type: 'premium_activated',
              plan,
              expiresAt: premiumExpiry.toISOString(),
            },
          }).catch((err) => {
            console.error('⚠️  Premium notification error (non-blocking):', err);
          });
        }

        console.log(`✅ CRITICAL: Premium activated for user ${userId} (${plan})`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId } = paymentIntent.metadata;

        if (userId) {
          // Log failed payment
          await prisma.payment.create({
            data: {
              userId,
              stripePaymentId: paymentIntent.id,
              stripeCustomerId: paymentIntent.customer as string,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              plan: paymentIntent.metadata.plan || 'unknown',
              status: 'failed',
              metadata: paymentIntent.metadata as any,
            },
          });

          console.log(`❌ Payment failed for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Handle subscription cancellation
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: false,
              premiumExpiry: null,
            },
          });

          console.log(`🔴 Premium cancelled for user ${user.afnId}`);
        }
        break;
      }

      default:
        console.log(`ℹ️  Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ CRITICAL: Webhook processing error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// GET /api/payments/history - Get payment history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(payments);
  } catch (error) {
    console.error('❌ Payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// GET /api/payments/status - Get premium status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        isPremium: true,
        premiumExpiry: true,
        _count: {
          select: {
            familyMembers: true,
            sentMessages: true,
            sosAlerts: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate days remaining
    let daysRemaining = null;
    if (user.isPremium && user.premiumExpiry) {
      const diff = user.premiumExpiry.getTime() - Date.now();
      daysRemaining = Math.ceil(diff / (24 * 60 * 60 * 1000));
    }

    res.json({
      isPremium: user.isPremium,
      premiumExpiry: user.premiumExpiry,
      daysRemaining,
      usage: {
        familyMembers: user._count.familyMembers,
        messagesSent: user._count.sentMessages,
        sosAlerts: user._count.sosAlerts,
      },
    });
  } catch (error) {
    console.error('❌ Premium status error:', error);
    res.status(500).json({ error: 'Failed to fetch premium status' });
  }
});

export default router;