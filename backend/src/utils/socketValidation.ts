/**
 * Socket.IO Event Validation
 * CRITICAL: Validates all socket events before processing
 */

export interface LocationUpdateData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
}

export interface MessageSendData {
  receiverAfnId: string;
  content: string;
  type?: string;
  latitude?: number;
  longitude?: number;
}

export interface SosSendData {
  latitude: number;
  longitude: number;
  message?: string;
  tags?: string[];
}

export interface MeshRelayData {
  meshId: string;
  type: string;
  payload: any;
  ttl: number;
  toAfnId?: string;
}

/**
 * Validate location data
 */
export const validateLocationUpdate = (data: any): data is LocationUpdateData => {
  if (!data || typeof data !== 'object') return false;
  
  const { latitude, longitude } = data;
  
  // CRITICAL: Validate coordinates
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) return false;
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) return false;
  
  // Optional fields
  if (data.accuracy !== undefined && (typeof data.accuracy !== 'number' || data.accuracy < 0)) return false;
  if (data.source !== undefined && typeof data.source !== 'string') return false;
  
  return true;
};

/**
 * Validate message send data
 */
export const validateMessageSend = (data: any): data is MessageSendData => {
  if (!data || typeof data !== 'object') return false;
  
  const { receiverAfnId, content } = data;
  
  // CRITICAL: Validate AFN-ID format
  if (typeof receiverAfnId !== 'string' || !/^AFN-[0-9A-Z]{8}$/.test(receiverAfnId)) return false;
  
  // CRITICAL: Validate content
  if (typeof content !== 'string' || content.length === 0 || content.length > 5000) return false;
  
  // Optional fields
  if (data.type !== undefined && !['text', 'sos', 'location', 'image'].includes(data.type)) return false;
  if (data.latitude !== undefined && (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90)) return false;
  if (data.longitude !== undefined && (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180)) return false;
  
  return true;
};

/**
 * Validate SOS send data
 */
export const validateSosSend = (data: any): data is SosSendData => {
  if (!data || typeof data !== 'object') return false;
  
  const { latitude, longitude } = data;
  
  // CRITICAL: Validate coordinates
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) return false;
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) return false;
  
  // Optional fields
  if (data.message !== undefined && (typeof data.message !== 'string' || data.message.length > 500)) return false;
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some((t: any) => typeof t !== 'string'))) return false;
  
  return true;
};

/**
 * Validate mesh relay data
 */
export const validateMeshRelay = (data: any): data is MeshRelayData => {
  if (!data || typeof data !== 'object') return false;
  
  const { meshId, type, payload, ttl } = data;
  
  // CRITICAL: Validate mesh ID
  if (typeof meshId !== 'string' || meshId.length < 10 || meshId.length > 100) return false;
  
  // CRITICAL: Validate type
  if (typeof type !== 'string' || !['SOS', 'PING', 'ACK', 'MSG', 'LOCATION'].includes(type)) return false;
  
  // CRITICAL: Validate payload
  if (!payload || typeof payload !== 'object') return false;
  
  // CRITICAL: Validate TTL
  if (typeof ttl !== 'number' || ttl < 1 || ttl > 10) return false;
  
  // Optional fields
  if (data.toAfnId !== undefined && (typeof data.toAfnId !== 'string' || !/^AFN-[0-9A-Z]{8}$/.test(data.toAfnId))) return false;
  
  return true;
};

/**
 * Sanitize socket data - removes potential XSS
 */
export const sanitizeSocketData = (data: any): any => {
  if (typeof data === 'string') {
    return data
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeSocketData);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      sanitized[key] = sanitizeSocketData(data[key]);
    }
    return sanitized;
  }
  
  return data;
};

