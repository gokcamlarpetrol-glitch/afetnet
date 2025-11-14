/**
 * FIREBASE MESSAGING TYPES - ELITE TYPE DEFINITIONS
 * Proper type definitions for Firebase Cloud Messaging
 */

/**
 * Firebase Cloud Messaging payload structure
 */
export interface FirebaseMessagePayload {
  notification?: {
    title?: string;
    body?: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  from?: string;
  messageId?: string;
  sentTime?: number;
  collapseKey?: string;
  [key: string]: unknown;
}

/**
 * Firebase notification data structure
 */
export interface FirebaseNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  [key: string]: unknown;
}









