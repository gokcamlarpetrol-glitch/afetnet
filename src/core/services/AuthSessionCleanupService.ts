import { createLogger } from '../utils/logger';
import { clearDeviceId, resetCachedDeviceId } from '../../lib/device';
import { useMessageStore } from '../stores/messageStore';
import { useFamilyStore } from '../stores/familyStore';
import { useHealthProfileStore } from '../stores/healthProfileStore';
import { useContactStore } from '../stores/contactStore';
import { contactService } from './ContactService';

const logger = createLogger('AuthSessionCleanupService');

class AuthSessionCleanupService {
  async clearLocalSessionData(): Promise<void> {
    const tasks: Array<Promise<unknown>> = [
      useMessageStore.getState().clear(),
      useFamilyStore.getState().clear(),
      useHealthProfileStore.getState().clearProfile(),
      useContactStore.getState().clearLocalCache(),
      contactService.clearAll(),
      clearDeviceId(),
    ];

    const results = await Promise.allSettled(tasks);
    const failedCount = results.filter((result) => result.status === 'rejected').length;

    resetCachedDeviceId();

    if (failedCount > 0) {
      logger.warn(`Session cleanup completed with ${failedCount} partial failure(s)`);
      return;
    }

    logger.info('Local session data cleaned successfully');
  }
}

export const authSessionCleanupService = new AuthSessionCleanupService();
