import { MeshMessage } from '../../services/mesh/MeshStore';

export const CHAT_RENDERABLE_TYPES = new Set<MeshMessage['type']>([
    'CHAT', 'SOS', 'IMAGE', 'VOICE', 'LOCATION',
]);

export const NON_CHAT_SYSTEM_TYPES = new Set([
    'family_status_update',
    'family_location_update',
    'family_location',
    'status_update',
    'device_status',
    'presence_update',
    'location',
    'typing',
    'ack',
    'reaction',
]);

export const getEnvelopeTypeFromContent = (content: string): string => {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return '';
    try {
        const parsed = JSON.parse(trimmed) as { type?: unknown };
        if (typeof parsed.type !== 'string') return '';
        return parsed.type.trim().toLowerCase();
    } catch {
        return '';
    }
};

export const isSystemPayloadMessage = (message: Pick<MeshMessage, 'type' | 'content'>): boolean => {
    if (message.type !== 'CHAT') return false;
    const envelopeType = getEnvelopeTypeFromContent(message.content);
    if (!envelopeType) return false;
    return NON_CHAT_SYSTEM_TYPES.has(envelopeType);
};
