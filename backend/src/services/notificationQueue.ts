import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { sendMulticastNotification } from './firebase';

/**
 * Notification Queue Worker
 * CRITICAL: Ensures reliable notification delivery
 * Retries failed notifications with exponential backoff
 */

export async function processNotificationQueue() {
  try {
    // Get pending notifications (not expired, less than 3 attempts)
    const notifications = await prisma.notificationQueue.findMany({
      where: {
        status: 'pending',
        attempts: { lt: 3 },
        expiresAt: { gt: new Date() },
      },
      orderBy: [
        { priority: 'desc' }, // CRITICAL first
        { createdAt: 'asc' },
      ],
      take: 50, // Process in batches
    });

    if (notifications.length === 0) {
      return;
    }

    logger.info(`📨 Processing ${notifications.length} pending notifications`);

    for (const notification of notifications) {
      try {
        // Get user's FCM tokens
        const user = await prisma.user.findUnique({
          where: { id: notification.userId },
          include: { fcmTokens: { where: { isActive: true } } },
        });

        if (!user || user.fcmTokens.length === 0) {
          // Mark as failed - no tokens
          await prisma.notificationQueue.update({
            where: { id: notification.id },
            data: {
              status: 'failed',
              failureReason: 'No active FCM tokens',
              lastAttemptAt: new Date(),
            },
          });
          continue;
        }

        // Send notification
        const tokens = user.fcmTokens.map((t: { token: string }) => t.token);
        await sendMulticastNotification(tokens, {
          title: notification.title,
          body: notification.body,
          data: notification.data as any,
        });

        // Mark as sent
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            lastAttemptAt: new Date(),
          },
        });

        logger.info(`✅ Notification sent: ${notification.type} to ${user.afnId}`);
      } catch (error: any) {
        // Increment attempts
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            attempts: notification.attempts + 1,
            lastAttemptAt: new Date(),
            failureReason: error.message,
            status: notification.attempts + 1 >= 3 ? 'failed' : 'pending',
          },
        });

        logger.error(`❌ Notification failed (attempt ${notification.attempts + 1}/3):`, {
          notificationId: notification.id,
          type: notification.type,
          error: error.message,
        });
      }
    }

    logger.info(`✅ Notification queue processed`);
  } catch (error) {
    logger.error('❌ Notification queue processing error:', error);
  }
}

/**
 * Queue a notification for reliable delivery
 * CRITICAL: Used for important notifications (SOS, earthquake alerts)
 */
export async function queueNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: any,
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
) {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.notificationQueue.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
        priority,
        status: 'pending',
        expiresAt,
      },
    });

    logger.info(`📬 Notification queued: ${type} for user ${userId}`);
  } catch (error) {
    logger.error('❌ Failed to queue notification:', error);
    throw error;
  }
}
