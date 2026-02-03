import { getErrorMessage } from '../../utils/errorUtils';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthService } from '../../services/AuthService';
import { EmailAuthService } from '../../services/EmailAuthService';
import { createLogger } from '../../utils/logger';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const logger = createLogger('LoginScreen');

export const LoginScreen = () => {
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isGoogleAuthAvailable, setIsGoogleAuthAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<any>();

  useEffect(() => {
    const checkAuthAvailability = async () => {
      const isAppleAvailable = await AppleAuthentication.isAvailableAsync();
      setIsAppleAuthAvailable(isAppleAvailable);
      setIsGoogleAuthAvailable(AuthService.isGoogleAuthAvailable());
    };
    checkAuthAvailability();
  }, []);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Uyarı', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);

    try {
      await EmailAuthService.login({ email, password });
    } catch (error: any) {
      Alert.alert('Giriş Hatası', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await AuthService.signInWithGoogle();
    } catch (error) {
      Alert.alert('Giriş Hatası', 'Google ile giriş başarısız oldu.');
    }
  };

  const handleAppleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await AuthService.signInWithApple();
    } catch (error: unknown) {
      const errorCode = (error as any)?.code;
      if (errorCode !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Giriş Hatası', getErrorMessage(error) || 'Apple ile giriş başarısız oldu.');
      }
    }
  };

  const handleForgotPassword = () => {
    Haptics.selectionAsync();
    navigation.navigate('ForgotPassword');
  };

  const handleRegister = () => {
    Haptics.selectionAsync();
    navigation.navigate('EmailRegister');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ELITE: Full-Screen Background Image */}
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
          <Text style={styles.title}>Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>
            Hesabınıza giriş yaparak devam edin
          </Text>
        </View>

        {/* ELITE: Compact Email/Password Form */}
        <View style={styles.formContainer}>
          {/* Email Input */}
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

          {/* Password Input */}
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
              autoComplete="password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
            <Text style={styles.forgotText}>Şifremi unuttum</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleEmailLogin}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            {isLoading ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <TouchableOpacity onPress={handleRegister} style={styles.registerLink}>
            <Text style={styles.registerText}>
              Hesabınız yok mu? <Text style={styles.registerBold}>Kayıt olun</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ELITE: Elegant Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ELITE: Compact Social Login Buttons */}
        <View style={styles.socialContainer}>
          {/* Google Button */}
          {isGoogleAuthAvailable && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleLogin}
              activeOpacity={0.85}
            >
              <View style={styles.socialIconWrapper}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
          )}

          {/* Apple Button */}
          {isAppleAuthAvailable && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleAppleLogin}
              activeOpacity={0.85}
            >
              <View style={styles.socialIconWrapper}>
                <Ionicons name="logo-apple" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Devam ederek Kullanım Koşulları ve Gizlilik Politikasını kabul etmiş olursunuz.
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingVertical: 60,
  },
  header: {
    marginBottom: 28,
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
  formContainer: {
    marginBottom: 20,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '400',
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
  registerLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  registerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  registerBold: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '400',
    marginHorizontal: 14,
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  socialIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  googleIcon: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  socialButtonText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 15,
  },
});
