import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface OfflineMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'voice' | 'image' | 'location' | 'emergency';
  content: string;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  delivered: boolean;
  encrypted: boolean;
}

class OfflineMessageManager extends SimpleEventEmitter {
  private messages = new Map<string, OfflineMessage>();

  constructor() {
    super();
    logger.debug('💬 Offline Message Manager initialized');
  }

  // CRITICAL: Send Message
  async sendMessage(message: Omit<OfflineMessage, 'id' | 'timestamp' | 'delivered'>): Promise<string> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const offlineMessage: OfflineMessage = {
        ...message,
        id: messageId,
        timestamp: Date.now(),
        delivered: false
      };

      this.messages.set(messageId, offlineMessage);
      
      this.emit('messageSent', offlineMessage);
      emergencyLogger.logSystem('info', 'Message sent', { messageId, type: message.type, priority: message.priority });
      
      return messageId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to send message', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Get Messages
  getMessages(): OfflineMessage[] {
    return Array.from(this.messages.values());
  }

  // CRITICAL: Get Queue Status
  getQueueStatus(): any {
    const messages = Array.from(this.messages.values());
    return {
      totalMessages: messages.length,
      pendingMessages: messages.filter(m => !m.delivered).length,
      deliveredMessages: messages.filter(m => m.delivered).length,
      criticalMessages: messages.filter(m => m.priority === 'critical').length,
      lastMessageTime: messages.length > 0 ? Math.max(...messages.map(m => m.timestamp)) : 0
    };
  }

  // CRITICAL: Send Text Message
  async sendTextMessage(content: string, to: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<string> {
    return this.sendMessage({
      from: 'current_user',
      to,
      type: 'text',
      content,
      priority,
      encrypted: false
    });
  }

  // CRITICAL: Retry Failed Messages
  async retryFailedMessages(): Promise<void> {
    try {
      const failedMessages = Array.from(this.messages.values()).filter(m => !m.delivered);
      
      for (const message of failedMessages) {
        // Retry logic here
        this.emit('messageRetry', message);
      }
      
      emergencyLogger.logSystem('info', 'Retried failed messages', { count: failedMessages.length });
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to retry messages', { error: String(error) });
    }
  }

  // CRITICAL: Clear Failed Messages
  async clearFailedMessages(): Promise<void> {
    try {
      const failedMessages = Array.from(this.messages.values()).filter(m => !m.delivered);
      
      for (const message of failedMessages) {
        this.messages.delete(message.id);
      }
      
      emergencyLogger.logSystem('info', 'Cleared failed messages', { count: failedMessages.length });
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to clear failed messages', { error: String(error) });
    }
  }
}

export const offlineMessageManager = new OfflineMessageManager();
export default OfflineMessageManager;