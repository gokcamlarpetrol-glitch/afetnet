/**
 * CUSTOM ERROR CLASSES - ELITE EDITION
 * Consistent error handling strategy for the messaging system
 * 
 * Q1 Fix: Standardized error handling across all services
 */

// Base error class for all AfetNet errors
export class AfetNetError extends Error {
    public code: string;
    public context?: Record<string, unknown>;
    public timestamp: number;
    public isRecoverable: boolean;

    constructor(
        message: string,
        code: string,
        options?: {
            context?: Record<string, unknown>;
            isRecoverable?: boolean;
            cause?: Error;
        }
    ) {
        super(message);
        this.name = 'AfetNetError';
        this.code = code;
        this.context = options?.context;
        this.timestamp = Date.now();
        this.isRecoverable = options?.isRecoverable ?? true;
        if (options?.cause) {
            this.context = { ...this.context, causeMessage: options.cause.message, causeStack: options.cause.stack };
        }

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AfetNetError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            isRecoverable: this.isRecoverable,
            stack: this.stack,
        };
    }
}

// Network related errors
export class NetworkError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'NETWORK_ERROR', { context, isRecoverable: true });
        this.name = 'NetworkError';
    }
}

// BLE/Mesh related errors
export class MeshError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'MESH_ERROR', { context, isRecoverable: true });
        this.name = 'MeshError';
    }
}

// Message validation errors
export class ValidationError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', { context, isRecoverable: false });
        this.name = 'ValidationError';
    }
}

// Encryption errors
export class CryptoError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CRYPTO_ERROR', { context, isRecoverable: false });
        this.name = 'CryptoError';
    }
}

// Storage errors
export class StorageError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'STORAGE_ERROR', { context, isRecoverable: true });
        this.name = 'StorageError';
    }
}

// Identity/Auth errors
export class IdentityError extends AfetNetError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'IDENTITY_ERROR', { context, isRecoverable: false });
        this.name = 'IdentityError';
    }
}

// Queue full error
export class QueueFullError extends AfetNetError {
    constructor(queueSize: number, maxSize: number) {
        super(
            `Message queue full (${queueSize}/${maxSize})`,
            'QUEUE_FULL',
            { context: { queueSize, maxSize }, isRecoverable: true }
        );
        this.name = 'QueueFullError';
    }
}

// Max retries exceeded
export class MaxRetriesError extends AfetNetError {
    constructor(messageId: string, retryCount: number) {
        super(
            `Max retries exceeded for message ${messageId} (${retryCount} attempts)`,
            'MAX_RETRIES',
            { context: { messageId, retryCount }, isRecoverable: false }
        );
        this.name = 'MaxRetriesError';
    }
}

// Error utility functions
export function isAfetNetError(error: unknown): error is AfetNetError {
    return error instanceof AfetNetError;
}

export function isRecoverableError(error: unknown): boolean {
    if (isAfetNetError(error)) {
        return error.isRecoverable;
    }
    // Network errors are generally recoverable
    if (error instanceof TypeError && error.message.includes('network')) {
        return true;
    }
    return false;
}

export function getErrorCode(error: unknown): string {
    if (isAfetNetError(error)) {
        return error.code;
    }
    if (error instanceof Error) {
        return 'UNKNOWN_ERROR';
    }
    return 'INVALID_ERROR';
}

export function wrapError(error: unknown, context?: string): AfetNetError {
    if (isAfetNetError(error)) {
        return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new AfetNetError(
        context ? `${context}: ${message}` : message,
        'WRAPPED_ERROR',
        {
            cause: error instanceof Error ? error : undefined,
            context: { originalError: String(error) },
        }
    );
}

export default {
    AfetNetError,
    NetworkError,
    MeshError,
    ValidationError,
    CryptoError,
    StorageError,
    IdentityError,
    QueueFullError,
    MaxRetriesError,
    isAfetNetError,
    isRecoverableError,
    getErrorCode,
    wrapError,
};
