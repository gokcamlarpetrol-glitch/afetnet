/**
 * AUTH LIFECYCLE — TIER1-02 cross-account state isolation
 *
 * Event bus for service-level login/logout hooks. Centralizes the "reset state
 * on user switch" pattern that was previously scattered across signOut(),
 * shutdownApp(), and onAuthStateChanged callsites — and frequently forgotten.
 *
 * KVKK Madde 4-6 risk: User A's PII (Apple name, FCM token, health-sharing
 * opt-in, session keys) bleeding into User B's session after signout.
 *
 * Usage:
 *
 *   // service-side (idempotent registration)
 *   authLifecycle.register({
 *     name: 'IdentityService',
 *     onLogin: async (uid) => identityService.initialize(),
 *     onLogout: async (_prevUid) => identityService.clearIdentity(),
 *   });
 *
 *   // authStore.ts — after successful login + Firebase user resolved
 *   await authLifecycle.emitLogin(user.uid);
 *
 *   // AuthService.signOut() — BEFORE Firebase signOut (so handlers can still
 *   // hit authenticated endpoints if needed)
 *   await authLifecycle.emitLogout(currentUid);
 *
 * Ordering:
 *   - onLogin fires in registration order (LRU services first)
 *   - onLogout fires in REVERSE registration order (LIFO — last-registered
 *     teardown first; mirrors stack unwind)
 *
 * Safety:
 *   - Each handler wrapped with 5s timeout (Promise.race)
 *   - Handler throws are caught + logged, do NOT abort the chain
 *   - Reentrant emit calls are queued (single-flight)
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('AuthLifecycle');

const HANDLER_TIMEOUT_MS = 5_000;

export type AuthLifecycleHandler = (uid: string) => void | Promise<void>;

export interface AuthLifecycleRegistration {
    /** Stable identifier — used for dedup + logging */
    name: string;
    /** Called when a user is authenticated (login OR app-resume with cached auth) */
    onLogin?: AuthLifecycleHandler;
    /** Called BEFORE Firebase signOut completes — receives the UID being logged out */
    onLogout?: AuthLifecycleHandler;
}

type EmitPhase = 'login' | 'logout';

interface QueuedEmit {
    phase: EmitPhase;
    uid: string;
    resolve: () => void;
    reject: (err: unknown) => void;
}

class AuthLifecycleBus {
    private registrations: AuthLifecycleRegistration[] = [];
    private isEmitting = false;
    private queue: QueuedEmit[] = [];
    /**
     * Last successful login UID — used by emitLogout when caller doesn't know
     * the UID (e.g. crash recovery). Cleared after logout.
     */
    private lastLoggedInUid: string | null = null;

    register(reg: AuthLifecycleRegistration): void {
        // Idempotent — replace existing registration with same name
        const existing = this.registrations.findIndex((r) => r.name === reg.name);
        if (existing >= 0) {
            this.registrations[existing] = reg;
        } else {
            this.registrations.push(reg);
        }
    }

    unregister(name: string): void {
        this.registrations = this.registrations.filter((r) => r.name !== name);
    }

    getLastLoggedInUid(): string | null {
        return this.lastLoggedInUid;
    }

    async emitLogin(uid: string): Promise<void> {
        return this.enqueue('login', uid);
    }

    async emitLogout(uid: string): Promise<void> {
        return this.enqueue('logout', uid);
    }

    private enqueue(phase: EmitPhase, uid: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ phase, uid, resolve, reject });
            void this.drainQueue();
        });
    }

    private async drainQueue(): Promise<void> {
        if (this.isEmitting) return;
        this.isEmitting = true;
        try {
            while (this.queue.length > 0) {
                const job = this.queue.shift();
                if (!job) break;
                try {
                    await this.runHandlers(job.phase, job.uid);
                    job.resolve();
                } catch (err) {
                    job.reject(err);
                }
            }
        } finally {
            this.isEmitting = false;
        }
    }

    private async runHandlers(phase: EmitPhase, uid: string): Promise<void> {
        // Logout: LIFO order (last-registered teardown first — mirrors stack unwind)
        // Login: registration order (foundational services initialize first)
        const handlers = phase === 'logout'
            ? [...this.registrations].reverse()
            : [...this.registrations];

        logger.info(`emit ${phase} uid=${uid.substring(0, 8)} handlers=${handlers.length}`);

        for (const reg of handlers) {
            const fn = phase === 'login' ? reg.onLogin : reg.onLogout;
            if (!fn) continue;

            try {
                const handlerPromise = Promise.resolve().then(() => fn(uid));
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(
                        () => reject(new Error(`Handler ${reg.name} timed out after ${HANDLER_TIMEOUT_MS}ms`)),
                        HANDLER_TIMEOUT_MS
                    );
                });
                await Promise.race([handlerPromise, timeoutPromise]);
            } catch (err) {
                // Handler failure does NOT abort the chain — logout MUST complete
                // every handler to fully clear state. Log + continue.
                logger.warn(`Handler "${reg.name}" ${phase} failed (continuing):`, err);
            }
        }

        if (phase === 'login') {
            this.lastLoggedInUid = uid;
        } else {
            this.lastLoggedInUid = null;
        }

        logger.info(`emit ${phase} uid=${uid.substring(0, 8)} complete`);
    }
}

export const authLifecycle = new AuthLifecycleBus();
