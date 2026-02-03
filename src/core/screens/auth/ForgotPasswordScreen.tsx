/**
 * AFETNET ŞİFRE SIFIRLAMA EKRANI
 * Zarif ve minimal tasarım
 * 
 * @author AfetNet Elite Auth System
 * @version 2.0.0
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { EmailAuthService } from '../../services/EmailAuthService';
import * as Haptics from 'expo-haptics';

export const ForgotPasswordScreen = () => {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Uyarı', 'Lütfen e-posta adresinizi girin.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);

        try {
            await EmailAuthService.sendPasswordReset(email);
            setEmailSent(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Alert.alert('Hata', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        Haptics.selectionAsync();
        navigation.goBack();
    };

    // Success Screen
    if (emailSent) {
        return (
            <View style={styles.container}>
                <Image
                    source={require('../../../../assets/images/login_background.jpg')}
                    style={styles.backgroundImage}
                    resizeMode="cover"
                />
                <View style={styles.overlay} />

                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <Ionicons name="mail" size={36} color="#FFFFFF" />
                    </View>
                    <Text style={styles.successTitle}>E-posta Gönderildi</Text>
                    <Text style={styles.successText}>
                        {email} adresine şifre sıfırlama bağlantısı gönderdik.
                    </Text>
                    <Text style={styles.spamNote}>
                        E-postayı bulamıyorsanız spam klasörünü kontrol edin.
                    </Text>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Login')}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.primaryButtonText}>Giriş Ekranına Dön</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setEmailSent(false)}
                        style={styles.resendButton}
                    >
                        <Text style={styles.resendText}>Tekrar Gönder</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Image
                source={require('../../../../assets/images/login_background.jpg')}
                style={styles.backgroundImage}
                resizeMode="cover"
            />
            <View style={styles.overlay} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Şifremi Unuttum</Text>
                    <Text style={styles.subtitle}>
                        E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="E-posta"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                        onPress={handleResetPassword}
                        disabled={isLoading}
                        activeOpacity={0.9}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#0A0A0A" size="small" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Bağlantı Gönder</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleBack} style={styles.backLink}>
                        <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.backLinkText}>Giriş ekranına dön</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
    },
    header: {
        marginBottom: 32,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 26,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        lineHeight: 20,
        letterSpacing: 0.2,
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 18,
        paddingHorizontal: 14,
        height: 48,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#FFFFFF',
        height: '100%',
    },
    primaryButton: {
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0A0A0A',
        letterSpacing: 0.3,
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    backLinkText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginLeft: 6,
    },
    // Success Screen
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    successText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
    },
    spamNote: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: 32,
    },
    resendButton: {
        paddingVertical: 12,
    },
    resendText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '400',
    },
});

export default ForgotPasswordScreen;
