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
    updatePassword,
    updateEmail,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider,
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
    'auth/weak-password': 'Şifre çok zayıf. En az 8 karakter kullanın.',
    'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password': 'Hatalı şifre.',
    'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen biraz bekleyin.',
    'auth/network-request-failed': 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
    'auth/invalid-credential': 'Geçersiz kimlik bilgileri. E-posta veya şifre hatalı.',
    'auth/requires-recent-login': 'Bu işlem için yeniden giriş yapmanız gerekiyor.',
    'auth/expired-action-code': 'Bağlantının süresi dolmuş. Lütfen yeni bağlantı isteyin.',
    'auth/invalid-action-code': 'Geçersiz bağlantı. Lütfen yeni bağlantı isteyin.',
    'auth/missing-email': 'E-posta adresi gereklidir.',
    'auth/missing-password': 'Şifre gereklidir.',
};

/**
 * Hata kodunu Türkçe mesaja çevir
 */
function getErrorMessage(error: any): string {
    const code = error?.code || '';
    return AUTH_ERROR_MESSAGES[code] || error?.message || 'Bilinmeyen bir hata oluştu.';
}

// ELITE: Minimum password length constant (synced with UI)
const MIN_PASSWORD_LENGTH = 8;

/**
 * Şifre geçerliliğini kontrol et
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return { valid: false, message: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.` };
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

    // ============================================================================
    // ELITE: Gelişmiş Güvenlik Özellikleri
    // ============================================================================

    /**
     * ELITE: Hassas işlemler için yeniden kimlik doğrulama
     * Şifre değiştirme, hesap silme gibi işlemlerden önce çağrılmalı
     */
    reauthenticate: async (password: string): Promise<void> => {
        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user || !user.email) {
                throw new Error('Oturum açık değil.');
            }

            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            logger.info('✅ Yeniden kimlik doğrulama başarılı');

        } catch (error: any) {
            logger.error('Yeniden kimlik doğrulama hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * ELITE: Şifre değiştirme
     * Önce reauthenticate() çağrılmalı
     */
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        // Validasyon
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.message);
        }

        if (currentPassword === newPassword) {
            throw new Error('Yeni şifre mevcut şifre ile aynı olamaz.');
        }

        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user || !user.email) {
                throw new Error('Oturum açık değil.');
            }

            // Önce yeniden kimlik doğrula
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Sonra şifreyi güncelle
            await updatePassword(user, newPassword);

            logger.info('✅ Şifre başarıyla değiştirildi');

        } catch (error: any) {
            logger.error('Şifre değiştirme hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * ELITE: E-posta adresi değiştirme
     * Hassas işlem - yeniden kimlik doğrulama gerektirir
     */
    changeEmail: async (password: string, newEmail: string): Promise<void> => {
        // Validasyon
        const emailValidation = validateEmail(newEmail);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.message);
        }

        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user || !user.email) {
                throw new Error('Oturum açık değil.');
            }

            if (user.email === newEmail.trim().toLowerCase()) {
                throw new Error('Yeni e-posta mevcut e-posta ile aynı.');
            }

            // Önce yeniden kimlik doğrula
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // Sonra e-postayı güncelle
            await updateEmail(user, newEmail.trim().toLowerCase());

            // Yeni e-posta için doğrulama gönder
            await sendEmailVerification(user);

            logger.info('✅ E-posta başarıyla değiştirildi, doğrulama gönderildi');

        } catch (error: any) {
            logger.error('E-posta değiştirme hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * ELITE: Hesap silme (KVKK/GDPR Uyumlu)
     * ! DİKKAT: Bu işlem geri alınamaz!
     * Tüm kullanıcı verileri silinir
     */
    deleteAccount: async (password: string): Promise<void> => {
        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user || !user.email) {
                throw new Error('Oturum açık değil.');
            }

            // CRITICAL: Yeniden kimlik doğrulama (güvenlik için zorunlu)
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            const userId = user.uid;
            const userEmail = user.email;

            // ELITE: İlişkili servisleri temizle (varsa)
            try {
                // Servislerde cleanup metodu varsa çağır
                if (typeof (presenceService as any).cleanup === 'function') {
                    await (presenceService as any).cleanup();
                }
                if (typeof (contactService as any).cleanup === 'function') {
                    await (contactService as any).cleanup();
                }
                if (typeof (contactRequestService as any).cleanup === 'function') {
                    await (contactRequestService as any).cleanup();
                }
                if (typeof (identityService as any).cleanup === 'function') {
                    await (identityService as any).cleanup();
                }
                logger.info('✅ İlişkili servisler temizlendi');
            } catch (cleanupError) {
                logger.warn('Servis temizleme hatası (devam ediliyor):', cleanupError);
            }

            // FINAL: Firebase Auth hesabını sil
            await deleteUser(user);

            logger.info('🗑️ Hesap başarıyla silindi:', { userId, userEmail });

        } catch (error: any) {
            logger.error('Hesap silme hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * ELITE: Kullanıcı bilgilerini yenile
     * E-posta doğrulama durumunu güncellemek için kullanılır
     */
    refreshUser: async (): Promise<void> => {
        try {
            const app = initializeFirebase();
            if (!app) throw new Error('Firebase başlatılamadı');

            const auth = getAuth(app);
            const user = auth.currentUser;

            if (!user) {
                throw new Error('Oturum açık değil.');
            }

            await user.reload();
            logger.info('✅ Kullanıcı bilgileri yenilendi');

        } catch (error: any) {
            logger.error('Kullanıcı yenileme hatası:', error);
            throw new Error(getErrorMessage(error));
        }
    },

    /**
     * ELITE: Mevcut kullanıcı bilgilerini al
     */
    getCurrentUser: (): { uid: string; email: string | null; displayName: string | null; emailVerified: boolean } | null => {
        const app = initializeFirebase();
        if (!app) return null;

        const auth = getAuth(app);
        const user = auth.currentUser;

        if (!user) return null;

        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
        };
    },
};

export default EmailAuthService;
