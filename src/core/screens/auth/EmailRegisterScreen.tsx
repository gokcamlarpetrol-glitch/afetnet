/**
 * AFETNET E-POSTA KAYIT EKRANI
 * Zarif ve minimal tasarım ile e-posta/şifre kayıt
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
    ScrollView,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { EmailAuthService } from '../../services/EmailAuthService';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';

// ELITE: Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const EmailRegisterScreen = () => {
    const navigation = useNavigation<any>();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        // ELITE: Enhanced validation
        if (!displayName.trim()) {
            Alert.alert('Uyarı', 'Lütfen adınızı girin.');
            return;
        }
        if (!email || !password) {
            Alert.alert('Uyarı', 'Lütfen e-posta ve şifrenizi girin.');
            return;
        }
        // ELITE: Email format validation
        if (!EMAIL_REGEX.test(email.trim())) {
            Alert.alert('Uyarı', 'Lütfen geçerli bir e-posta adresi girin.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Uyarı', 'Şifreler eşleşmiyor.');
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            Alert.alert('Uyarı', `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);

        try {
            await EmailAuthService.register({
                email,
                password,
                displayName: displayName.trim(),
            });

            // ELITE: Success with navigation to login
            Alert.alert(
                'Kayıt Başarılı',
                'Hesabınız oluşturuldu. E-posta adresinize doğrulama bağlantısı gönderdik.',
                [{ text: 'Giriş Yap', onPress: () => navigation.navigate('Login') }]
            );
        } catch (error: any) {
            Alert.alert('Kayıt Hatası', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        Haptics.selectionAsync();
        navigation.goBack();
    };

    const handleLogin = () => {
        Haptics.selectionAsync();
        navigation.navigate('Login');
    };

    // ELITE: Open external links
    const handleOpenTerms = () => {
        Haptics.selectionAsync();
        Linking.openURL('https://afetnet.com/kullanim-kosullari');
    };

    const handleOpenPrivacy = () => {
        Haptics.selectionAsync();
        Linking.openURL('https://afetnet.com/gizlilik-politikasi');
    };

    const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
    const emailValid = EMAIL_REGEX.test(email.trim());
    const passwordsMatch = password === confirmPassword && password.length > 0;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* ELITE: Background */}
            <Image
                source={require('../../../../assets/images/login_background.jpg')}
                style={styles.backgroundImage}
                resizeMode="cover"
            />
            <View style={styles.overlay} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Hesap Oluştur</Text>
                    <Text style={styles.subtitle}>Güvenliğiniz bizim önceliğimiz</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Display Name */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Ad Soyad"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={displayName}
                            onChangeText={setDisplayName}
                            autoCapitalize="words"
                            autoComplete="name"
                        />
                    </View>

                    {/* Email */}
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

                    {/* Password */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Şifre"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password-new"
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeButton}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color="rgba(255,255,255,0.5)"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Confirm Password */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Şifreyi tekrar girin"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                            autoComplete="password-new"
                        />
                        <TouchableOpacity
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            style={styles.eyeButton}
                        >
                            <Ionicons
                                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color="rgba(255,255,255,0.5)"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Password Requirements - Minimal */}
                    <View style={styles.requirements}>
                        <View style={styles.reqRow}>
                            <Ionicons
                                name={passwordValid ? 'checkmark-circle' : 'ellipse-outline'}
                                size={12}
                                color={passwordValid ? '#4CAF50' : 'rgba(255,255,255,0.3)'}
                            />
                            <Text style={[styles.reqText, passwordValid && styles.reqMet]}>En az {MIN_PASSWORD_LENGTH} karakter</Text>
                        </View>
                        <View style={styles.reqRow}>
                            <Ionicons
                                name={passwordsMatch ? 'checkmark-circle' : 'ellipse-outline'}
                                size={12}
                                color={passwordsMatch ? '#4CAF50' : 'rgba(255,255,255,0.3)'}
                            />
                            <Text style={[styles.reqText, passwordsMatch && styles.reqMet]}>Şifreler eşleşiyor</Text>
                        </View>
                    </View>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={isLoading}
                        activeOpacity={0.9}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#0A0A0A" size="small" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Kayıt Ol</Text>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <TouchableOpacity onPress={handleLogin} style={styles.loginLink}>
                        <Text style={styles.loginText}>
                            Zaten hesabınız var mı? <Text style={styles.loginBold}>Giriş yapın</Text>
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Terms - ELITE: Clickable links */}
                <Text style={styles.terms}>
                    Kayıt olarak{' '}
                    <Text style={styles.termsLink} onPress={handleOpenTerms}>Kullanım Koşulları</Text>
                    {' '}ve{' '}
                    <Text style={styles.termsLink} onPress={handleOpenPrivacy}>Gizlilik Politikası</Text>
                    'nı kabul etmiş olursunuz.
                </Text>
            </ScrollView>
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 28,
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
        marginBottom: 12,
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
    eyeButton: {
        padding: 6,
    },
    requirements: {
        marginBottom: 18,
        paddingLeft: 2,
    },
    reqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    reqText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        marginLeft: 6,
    },
    reqMet: {
        color: '#4CAF50',
    },
    primaryButton: {
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
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
    loginLink: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    loginText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    loginBold: {
        color: '#FFFFFF',
        fontWeight: '500',
    },
    terms: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.35)',
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 16,
    },
    termsLink: {
        color: 'rgba(255, 255, 255, 0.7)',
        textDecorationLine: 'underline',
    },
});

export default EmailRegisterScreen;
