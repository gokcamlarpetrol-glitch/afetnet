/**
 * AFETNET E-POSTA KİMLİK DOĞRULAMA SİSTEMİ
 * Elite-seviye e-posta/şifre kimlik doğrulama
 * 
 * Özellikler:
 * - Kayıt (createUserWithEmailAndPassword)
 * - Giriş (signInWithEmailAndPassword)
 * - Şifre sıfırlama (sendPasswordResetEmail)
 * - E-posta doğrulama (sendEmailVerification)
 * 
 * @author AfetNet Elite Auth System
 * @version 1.0.0
 */

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    User,
    UserCredential,
} from 'firebase/auth';
import { initializeFirebase } from '../../lib/firebase';
import { createLogger } from '../utils/logger';
import { identityService } from './IdentityService';
import { contactService } from './ContactService';
import { presenceService } from './PresenceService';
import { contactRequestService } from './ContactRequestService';
import { AuthService } from './AuthService';

const logger = createLogger('EmailAuthService');

// ============================================================================
// ELITE: TypeScript Strict Interfaces
// ============================================================================

/** E-posta kayıt verileri */
export interface EmailRegisterData {
    email: string;
    password: string;
    displayName?: string;
}

/** E-posta giriş verileri */
export interface EmailLoginData {
    email: string;
    password: string;
}

/** Auth hata kodları (Türkçe mesajlar için) */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/operation-not-allowed': 'E-posta/şifre girişi etkin değil.',
    'auth/weak-password': 'Şifre çok zayıf. En az 6 karakter kullanın.',
    'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password': 'Hatalı şifre.',
    'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen biraz bekleyin.',
    'auth/network-request-failed': 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
    'auth/invalid-credential': 'Geçersiz kimlik bilgileri.',
    'auth/requires-recent-login': 'Bu işlem için yeniden giriş yapmanız gerekiyor.',
};

/**
 * Hata kodunu Türkçe mesaja çevir
 */
function getErrorMessage(error: any): string {
    const code = error?.code || '';
    return AUTH_ERROR_MESSAGES[code] || error?.message || 'Bilinmeyen bir hata oluştu.';
}

/**
 * Şifre geçerliliğini kontrol et
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 6) {
        return { valid: false, message: 'Şifre en az 6 karakter olmalıdır.' };
    }
    if (password.length > 128) {
        return { valid: false, message: 'Şifre çok uzun.' };
    }
    // Opsiyonel: Güçlü şifre kontrolü
    // const hasUpperCase = /[A-Z]/.test(password);
    // const hasLowerCase = /[a-z]/.test(password);
    // const hasNumber = /[0-9]/.test(password);
    // if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    //   return { valid: false, message: 'Şifre büyük harf, küçük harf ve rakam içermelidir.' };
    // }
    return { valid: true };
}

/**
 * E-posta geçerliliğini kontrol et
 */
function validateEmail(email: string): { valid: boolean; message?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Geçerli bir e-posta adresi girin.' };
    }
    return { valid: true };
}

// ============================================================================
// ELITE: E-posta Kimlik Doğrulama Servisi
// ============================================================================

export const EmailAuthService = {
    /**
     * E-posta ve şifre ile KAYIT
     */
    register: async (data: EmailRegisterData): Promise<User> => {
        const { email, password, displayName } = data;

        // Validasyonlar
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.message);
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.message);
        }

        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const userCredential: UserCredential = await createUserWithEmailAndPassword(
                auth,
                email.trim().toLowerCase(),
                password
            );

            const user = userCredential.user;

            // ELITE: Kullanıcı adını güncelle
            if (displayName) {
                await updateProfile(user, { displayName: displayName.trim() });
            }

            // ELITE: E-posta doğrulama gönder
            try {
                await sendEmailVerification(user);
                logger.info('📧 E-posta doğrulama gönderildi:', email);
            } catch (verifyError) {
                logger.warn('E-posta doğrulama gönderilemedi (engelleyici değil):', verifyError);
            }

            // ELITE: Profil senkronizasyonu
            try {
                await AuthService.syncUserProfile(user);
            } catch (syncError) {
                logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
            }

            // ELITE: Servis senkronizasyonu
            try {
                await identityService.syncFromFirebase(user);
                await contactService.initialize();
                await presenceService.initialize();
                await contactRequestService.initialize();
                logger.info('✅ Tüm servisler kayıt sonrası senkronize edildi');
            } catch (syncError) {
                logger.warn('Servis senkronizasyonu başarısız (engelleyici değil):', syncError);
            }

            logger.info('✅ E-posta ile kayıt başarılı:', user.uid);
            return user;

        } catch (error: any) {
            logger.error('E-posta kayıt hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * E-posta ve şifre ile GİRİŞ
     */
    login: async (data: EmailLoginData): Promise<User> => {
        const { email, password } = data;

        // Validasyonlar
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.message);
        }

        if (!password) {
            throw new Error('Şifre gereklidir.');
        }

        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const userCredential: UserCredential = await signInWithEmailAndPassword(
                auth,
                email.trim().toLowerCase(),
                password
            );

            const user = userCredential.user;

            // ELITE: Profil senkronizasyonu
            try {
                await AuthService.syncUserProfile(user);
            } catch (syncError) {
                logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
            }

            // ELITE: Servis senkronizasyonu
            try {
                await identityService.syncFromFirebase(user);
                await contactService.initialize();
                await presenceService.initialize();
                await contactRequestService.initialize();
                logger.info('✅ Tüm servisler giriş sonrası senkronize edildi');
            } catch (syncError) {
                logger.warn('Servis senkronizasyonu başarısız (engelleyici değil):', syncError);
            }

            logger.info('✅ E-posta ile giriş başarılı:', user.uid);
            return user;

        } catch (error: any) {
            logger.error('E-posta giriş hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * Şifre sıfırlama e-postası gönder
     */
    sendPasswordReset: async (email: string): Promise<void> => {
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.message);
        }

        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());

            logger.info('📧 Şifre sıfırlama e-postası gönderildi:', email);

        } catch (error: any) {
            logger.error('Şifre sıfırlama hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * E-posta doğrulama tekrar gönder
     */
    resendVerificationEmail: async (): Promise<void> => {
        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user) {
                throw new Error('Kullanıcı oturumu bulunamadı.');
            }

            if (user.emailVerified) {
                throw new Error('E-posta zaten doğrulanmış.');
            }

            await sendEmailVerification(user);
            logger.info('📧 Doğrulama e-postası tekrar gönderildi');

        } catch (error: any) {
            logger.error('Doğrulama e-postası hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * E-posta doğrulanmış mı kontrol et
     */
    isEmailVerified: (): boolean => {
        const app = initializeFirebase();
        if (!app) return false;

        const auth = getAuth(app);
        return auth.currentUser?.emailVerified ?? false;
    },

    /**
     * Mevcut kullanıcının e-postasını al
     */
    getCurrentEmail: (): string | null => {
        const app = initializeFirebase();
        if (!app) return null;

        const auth = getAuth(app);
        return auth.currentUser?.email ?? null;
    },
};

export default EmailAuthService;
