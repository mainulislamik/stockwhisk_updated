import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Surface,
  Switch,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

type AuthMode = 'login' | 'signup' | 'forgot';

const REMEMBER_EMAIL_KEY = 'stockwhisk_remembered_email';

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const { language, toggleLanguage, isDarkMode, toggleDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        let saved = '';
        if (Platform.OS === 'web') {
          saved = localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
        } else {
          saved = (await SecureStore.getItemAsync(REMEMBER_EMAIL_KEY)) || '';
        }
        if (saved) {
          setLoginEmail(saved);
          setRememberMe(true);
        }
      } catch {}
    };
    loadRememberedEmail();
  }, []);

  // 2. Signup State
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [businessType, setBusinessType] = useState('general');
  const [referralCode, setReferralCode] = useState('');
  const [signupOtp, setSignupOtp] = useState('');
  const [signupTimer, setSignupTimer] = useState(180);

  // 3. Forgot Password State
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotTimer, setForgotTimer] = useState(180);

  // Countdown timer for OTP steps
  useEffect(() => {
    let interval: any;
    if (mode === 'signup' && signupStep === 2 && signupTimer > 0) {
      interval = setInterval(() => setSignupTimer(prev => prev - 1), 1000);
    } else if (mode === 'forgot' && forgotStep === 2 && forgotTimer > 0) {
      interval = setInterval(() => setForgotTimer(prev => prev - 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, signupStep, signupTimer, forgotStep, forgotTimer]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const switchMode = (newMode: AuthMode) => {
    setError('');
    setSuccess('');
    setMode(newMode);
    if (newMode === 'signup') {
      setSignupStep(1);
      setSignupTimer(180);
    } else if (newMode === 'forgot') {
      setForgotStep(1);
      setForgotTimer(180);
      if (loginEmail) setForgotEmail(loginEmail);
    }
  };

  // --- Handlers ---

  // 1. Handle Login
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setError(isBN ? 'ইমেইল ও পাসওয়ার্ড প্রদান করুন।' : 'Please enter email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/token/', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      try {
        if (rememberMe) {
          if (Platform.OS === 'web') localStorage.setItem(REMEMBER_EMAIL_KEY, loginEmail.trim());
          else await SecureStore.setItemAsync(REMEMBER_EMAIL_KEY, loginEmail.trim());
        } else {
          if (Platform.OS === 'web') localStorage.removeItem(REMEMBER_EMAIL_KEY);
          else await SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY);
        }
      } catch {}

      await login(res.data.access, res.data.refresh);
    } catch (e: any) {
      if (e.message === 'Network Error') {
        setError(isBN ? 'নেটওয়ার্ক ত্রুটি: সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না।' : 'Network error: Cannot reach server.');
      } else {
        setError(
          e.response?.data?.detail ||
          e.response?.data?.error ||
          (isBN ? 'ইমেইল অথবা পাসওয়ার্ড ভুল হয়েছে।' : 'Invalid credentials. Please try again.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Signup: Step 1 (Request Registration OTP)
  const handleInitiateSignup = async () => {
    if (!shopName.trim()) {
      setError(isBN ? 'দোকানের নাম আবশ্যক।' : 'Shop name is required.');
      return;
    }
    if (!signupEmail.trim()) {
      setError(isBN ? 'ইমেইল আবশ্যক।' : 'Email address is required.');
      return;
    }
    if (!signupPhone.trim()) {
      setError(isBN ? 'মোবাইল নম্বর আবশ্যক।' : 'Phone number is required.');
      return;
    }
    if (signupPassword.length < 6) {
      setError(isBN ? 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/register/', {
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || shopName.trim(),
        owner_email: signupEmail.trim().toLowerCase(),
        email: signupEmail.trim().toLowerCase(),
        owner_password: signupPassword,
        password: signupPassword,
        phone: signupPhone.trim(),
        business_type: businessType,
        referral_code: referralCode.trim().toUpperCase() || undefined,
      });
      setSuccess(isBN ? 'আপনার ইমেইলে একটি ৬-ডিজিটের ওটিপি (OTP) পাঠানো হয়েছে।' : 'A 6-digit OTP has been sent to your email.');
      setSignupStep(2);
      setSignupTimer(180);
    } catch (e: any) {
      const data = e.response?.data;
      let msg = data?.detail || data?.error || (isBN ? 'রেজিস্ট্রেশন শুরু করতে ব্যর্থ হয়েছে।' : 'Registration failed.');
      if (data?.owner_email && Array.isArray(data.owner_email)) msg = data.owner_email[0];
      if (data?.email && Array.isArray(data.email)) msg = data.email[0];
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Signup: Step 2 (Verify OTP & Auto-Login)
  const handleVerifySignupOtp = async () => {
    if (!signupOtp.trim() || signupOtp.trim().length < 4) {
      setError(isBN ? 'সঠিক ওটিপি কোডটি লিখুন।' : 'Please enter the verification OTP.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp/', {
        email: signupEmail.trim().toLowerCase(),
        otp: signupOtp.trim(),
      });

      if (res.data?.access && res.data?.refresh) {
        Alert.alert(isBN ? 'অভিনন্দন! 🎉' : 'Congratulations! 🎉', isBN ? 'আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।' : 'Your account was created successfully.');
        await login(res.data.access, res.data.refresh);
      } else {
        setSuccess(isBN ? 'অ্যাকাউন্ট তৈরি সম্পন্ন হয়েছে! এখন লগইন করুন।' : 'Account created! Please sign in.');
        setLoginEmail(signupEmail);
        setLoginPassword(signupPassword);
        switchMode('login');
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error || (isBN ? 'ভুল বা মেয়াদোত্তীর্ণ ওটিপি কোড।' : 'Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password: Step 1 (Request Password Reset OTP)
  const handleRequestForgotOtp = async () => {
    if (!forgotEmail.trim()) {
      setError(isBN ? 'আপনার নিবন্ধিত ইমেইল ঠিকানা লিখুন।' : 'Please enter your registered email.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/password-reset/request-otp/', {
        email: forgotEmail.trim().toLowerCase(),
      });
      setSuccess(isBN ? 'পাসওয়ার্ড রিসেট করার ৬-ডিজিট কোড আপনার ইমেইলে পাঠানো হয়েছে।' : 'Reset OTP has been sent to your email.');
      setForgotStep(2);
      setForgotTimer(180);
    } catch (e: any) {
      setError(e.response?.data?.detail || (isBN ? 'ওটিপি পাঠাতে সমস্যা হয়েছে।' : 'Failed to send reset code.'));
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password: Step 2 (Verify OTP & Reset Password)
  const handleResetPassword = async () => {
    if (!forgotOtp.trim()) {
      setError(isBN ? 'ওটিপি কোডটি লিখুন।' : 'Please enter the OTP.');
      return;
    }
    if (newPassword.length < 6) {
      setError(isBN ? 'নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isBN ? 'উভয় পাসওয়ার্ড মিলছে না।' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/password-reset/verify-otp/', {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        new_password: newPassword,
      });

      Alert.alert(
        isBN ? 'সফল!' : 'Success!',
        isBN ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' : 'Password reset successfully. Please sign in.'
      );
      setLoginEmail(forgotEmail);
      setLoginPassword(newPassword);
      switchMode('login');
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error || (isBN ? 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।' : 'Password reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  const BUSINESS_TYPES = [
    { key: 'general', label: isBN ? 'সাধারণ রিটেইল শপ' : 'General Retail' },
    { key: 'electronics', label: isBN ? 'ইলেকট্রনিক্স ও মোবাইল' : 'Electronics & Mobile' },
    { key: 'grocery', label: isBN ? 'মুদি ও ডিপার্টমেন্টাল' : 'Grocery & Superstore' },
    { key: 'clothing', label: isBN ? 'গার্মেন্টস ও ফ্যাশন' : 'Clothing & Fashion' },
    { key: 'pharmacy', label: isBN ? 'ফার্মেসি / ওষুধ' : 'Pharmacy' },
    { key: 'service', label: isBN ? 'সার্ভিস ও মেরামত শপ' : 'Repair & Service' },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDarkMode ? '#090d16' : '#f1f5f9' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Language & Theme Switcher Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={toggleLanguage}
            style={[styles.topPill, { backgroundColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons name="translate" size={16} color="#2563eb" />
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 4, color: '#2563eb' }}>
              {isBN ? 'English' : 'বাংলা'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleDarkMode}
            style={[styles.topPill, { backgroundColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons
              name={isDarkMode ? 'weather-sunny' : 'weather-night'}
              size={16}
              color={isDarkMode ? '#fbbf24' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Main Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
          {/* Top Card Navigation / Back Button */}
          {mode !== 'login' && (
            <TouchableOpacity
              onPress={() => switchMode('login')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                marginBottom: 8,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color="#2563eb" />
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#2563eb', marginLeft: 4 }}>
                {isBN ? 'লগইনে ফিরে যান' : 'Back to Sign In'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Brand Header */}
          <View style={styles.header}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onSurface, marginTop: 8 }}>
              {mode === 'login' && (isBN ? 'স্বাগতম' : 'Welcome Back')}
              {mode === 'signup' && (isBN ? 'নতুন দোকান রেজিস্টার' : 'Create Free Account')}
              {mode === 'forgot' && (isBN ? 'পাসওয়ার্ড রিসেট' : 'Reset Password')}
            </Text>
            <Text variant="bodySmall" style={{ color: '#64748b', marginTop: 3, textAlign: 'center' }}>
              {mode === 'login' && (isBN ? 'ইনভেন্টরি ও সেলস পরিচালনা করতে লগইন করুন' : 'Sign in to manage your shop & inventory')}
              {mode === 'signup' && (isBN ? 'কয়েকটি ধাপে আপনার ডিজিটাল শপ শুরু করুন' : 'Get started with your retail POS & inventory')}
              {mode === 'forgot' && (isBN ? 'ইমেইলে ওটিপি কোড দিয়ে নতুন পাসওয়ার্ড সেট করুন' : 'Verify your email with OTP to reset password')}
            </Text>
          </View>

          {/* Feedback Messages */}
          {error ? (
            <Surface style={[styles.alertContainer, { backgroundColor: '#fee2e2' }]} elevation={0}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 6 }} />
              <Text style={{ color: '#b91c1c', fontSize: 12, flex: 1 }}>{error}</Text>
            </Surface>
          ) : null}

          {success ? (
            <Surface style={[styles.alertContainer, { backgroundColor: '#dcfce7' }]} elevation={0}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#16a34a" style={{ marginRight: 6 }} />
              <Text style={{ color: '#15803d', fontSize: 12, flex: 1 }}>{success}</Text>
            </Surface>
          ) : null}

          {/* ========================================================================= */}
          {/* MODE 1: LOGIN */}
          {/* ========================================================================= */}
          {mode === 'login' && (
            <View>
              <TextInput
                label={isBN ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}
                value={loginEmail}
                onChangeText={setLoginEmail}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                disabled={loading}
                left={<TextInput.Icon icon="email-outline" />}
              />

              <TextInput
                label={isBN ? 'পাসওয়ার্ড' : 'Password'}
                value={loginPassword}
                onChangeText={setLoginPassword}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showLoginPassword}
                disabled={loading}
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    icon={showLoginPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                  />
                }
              />

              <View style={styles.switchRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch value={rememberMe} onValueChange={setRememberMe} color="#2563eb" />
                  <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>
                    {isBN ? 'মনে রাখুন' : 'Remember Me'}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => switchMode('forgot')}>
                  <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: 'bold' }}>
                    {isBN ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Button
                mode="contained"
                buttonColor="#2563eb"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.mainButton}
                contentStyle={{ paddingVertical: 6 }}
                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              >
                {isBN ? 'লগইন করুন' : 'Sign In'}
              </Button>

              <Divider style={{ marginVertical: 18 }} />

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {isBN ? 'কোনো অ্যাকাউন্ট নেই?' : "Don't have an account?"}
                </Text>
                <TouchableOpacity onPress={() => switchMode('signup')} style={{ marginTop: 6, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 14, color: '#16a34a', fontWeight: 'bold' }}>
                    ✨ {isBN ? 'নতুন অ্যাকাউন্ট তৈরি করুন (Sign Up)' : 'Create New Account (Sign Up)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: SIGNUP */}
          {/* ========================================================================= */}
          {mode === 'signup' && (
            <View>
              {/* Step indicator */}
              <View style={styles.stepHeader}>
                <View style={[styles.stepDot, { backgroundColor: '#16a34a' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>1</Text>
                </View>
                <View style={[styles.stepLine, { backgroundColor: signupStep === 2 ? '#16a34a' : '#cbd5e1' }]} />
                <View style={[styles.stepDot, { backgroundColor: signupStep === 2 ? '#16a34a' : '#cbd5e1' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>2</Text>
                </View>
              </View>

              {/* Step 1: Info */}
              {signupStep === 1 && (
                <View>
                  <TextInput
                    label={isBN ? 'দোকান / প্রতিষ্ঠানের নাম *' : 'Shop Name *'}
                    value={shopName}
                    onChangeText={setShopName}
                    mode="outlined"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="store-outline" />}
                  />

                  <TextInput
                    label={isBN ? 'মালিকের নাম *' : 'Owner Name *'}
                    value={ownerName}
                    onChangeText={setOwnerName}
                    mode="outlined"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="account-outline" />}
                  />

                  <TextInput
                    label={isBN ? 'মোবাইল নম্বর *' : 'Phone Number *'}
                    value={signupPhone}
                    onChangeText={setSignupPhone}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="phone-outline" />}
                  />

                  <TextInput
                    label={isBN ? 'ইমেইল অ্যাড্রেস *' : 'Email Address *'}
                    value={signupEmail}
                    onChangeText={setSignupEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="email-outline" />}
                  />

                  <TextInput
                    label={isBN ? 'পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর) *' : 'Password (min 6 chars) *'}
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    mode="outlined"
                    secureTextEntry={!showSignupPassword}
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={
                      <TextInput.Icon
                        icon={showSignupPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowSignupPassword(!showSignupPassword)}
                      />
                    }
                  />

                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 4 }}>
                    {isBN ? 'ব্যবসার ধরন' : 'Business Category'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {BUSINESS_TYPES.map(b => (
                      <TouchableOpacity
                        key={b.key}
                        onPress={() => setBusinessType(b.key)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: businessType === b.key ? '#16a34a' : '#cbd5e1',
                          backgroundColor: businessType === b.key ? '#dcfce7' : theme.colors.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: businessType === b.key ? '#15803d' : theme.colors.onSurface,
                            fontWeight: businessType === b.key ? 'bold' : 'normal',
                          }}
                        >
                          {b.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    label={isBN ? 'রেফারেল কোড (ঐচ্ছিক)' : 'Referral Code (Optional)'}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    mode="outlined"
                    autoCapitalize="characters"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="gift-outline" />}
                  />

                  <Button
                    mode="contained"
                    buttonColor="#16a34a"
                    onPress={handleInitiateSignup}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 6 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'ওটিপি কোড পাঠান ➜' : 'Send Verification OTP ➜'}
                  </Button>
                </View>
              )}

              {/* Step 2: Verify OTP */}
              {signupStep === 2 && (
                <View>
                  <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', padding: 12, borderRadius: 10, marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, color: '#16a34a', textAlign: 'center' }}>
                      {isBN
                        ? `আমরা ${signupEmail} ঠিকানায় ৬-ডিজিটের একটি কোড পাঠিয়েছি।`
                        : `We sent a 6-digit verification code to ${signupEmail}.`}
                    </Text>
                  </View>

                  <TextInput
                    label={isBN ? '৬-ডিজিট ওটিপি কোড' : '6-Digit OTP Code'}
                    value={signupOtp}
                    onChangeText={setSignupOtp}
                    mode="outlined"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 4 }]}
                    disabled={loading}
                    left={<TextInput.Icon icon="shield-key-outline" />}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      ⏳ {isBN ? 'মেয়াদ বাকি:' : 'Expires in:'} {formatSeconds(signupTimer)}
                    </Text>
                    {signupTimer === 0 ? (
                      <TouchableOpacity onPress={handleInitiateSignup} disabled={loading}>
                        <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: 'bold' }}>
                          {isBN ? 'পুনরায় কোড পাঠান' : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Button
                    mode="contained"
                    buttonColor="#16a34a"
                    onPress={handleVerifySignupOtp}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 6 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'যাচাই করুন ও শুরু করুন 🎉' : 'Verify & Launch Shop 🎉'}
                  </Button>

                  <Button mode="text" onPress={() => setSignupStep(1)} style={{ marginTop: 8 }}>
                    {isBN ? '← তথ্য পরিবর্তন করুন' : '← Edit Information'}
                  </Button>
                </View>
              )}

              <Divider style={{ marginVertical: 16 }} />

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {isBN ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : 'Already have an account?'}
                </Text>
                <TouchableOpacity onPress={() => switchMode('login')} style={{ marginTop: 6, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: 'bold' }}>
                    {isBN ? 'লগইন করুন (Sign In)' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: FORGOT PASSWORD */}
          {/* ========================================================================= */}
          {mode === 'forgot' && (
            <View>
              {/* Step 1: Request Reset OTP */}
              {forgotStep === 1 && (
                <View>
                  <TextInput
                    label={isBN ? 'নিবন্ধিত ইমেইল অ্যাড্রেস' : 'Registered Email Address'}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="email-outline" />}
                  />

                  <Button
                    mode="contained"
                    buttonColor="#f59e0b"
                    onPress={handleRequestForgotOtp}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 6 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'রিসেট ওটিপি কোড পাঠান ➜' : 'Send Reset Code ➜'}
                  </Button>
                </View>
              )}

              {/* Step 2: Enter OTP & New Password */}
              {forgotStep === 2 && (
                <View>
                  <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fffbeb', padding: 12, borderRadius: 10, marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, color: '#b45309', textAlign: 'center' }}>
                      {isBN
                        ? `আপনার ${forgotEmail} ইমেইলে প্রেরিত ওটিপি কোডটি লিখুন।`
                        : `Enter the OTP code sent to ${forgotEmail}.`}
                    </Text>
                  </View>

                  <TextInput
                    label={isBN ? '৬-ডিজিট ওটিপি কোড' : '6-Digit OTP Code'}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    mode="outlined"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { textAlign: 'center', fontSize: 18, letterSpacing: 4 }]}
                    disabled={loading}
                    left={<TextInput.Icon icon="shield-key-outline" />}
                  />

                  <TextInput
                    label={isBN ? 'নতুন পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)' : 'New Password (min 6 chars)'}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    mode="outlined"
                    secureTextEntry={!showNewPassword}
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={
                      <TextInput.Icon
                        icon={showNewPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      />
                    }
                  />

                  <TextInput
                    label={isBN ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    mode="outlined"
                    secureTextEntry={!showNewPassword}
                    style={styles.input}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-check-outline" />}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      ⏳ {isBN ? 'মেয়াদ বাকি:' : 'Expires in:'} {formatSeconds(forgotTimer)}
                    </Text>
                    {forgotTimer === 0 ? (
                      <TouchableOpacity onPress={handleRequestForgotOtp} disabled={loading}>
                        <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: 'bold' }}>
                          {isBN ? 'পুনরায় কোড পাঠান' : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Button
                    mode="contained"
                    buttonColor="#f59e0b"
                    onPress={handleResetPassword}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 6 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'পাসওয়ার্ড পরিবর্তন করুন 🔒' : 'Reset Password & Save 🔒'}
                  </Button>
                </View>
              )}

              <Divider style={{ marginVertical: 16 }} />

              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={() => switchMode('login')} style={{ paddingVertical: 4 }}>
                  <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: 'bold' }}>
                    {isBN ? '← লগইনে ফিরে যান' : '← Back to Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    width: '100%',
  },
  topBar: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 1,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    width: 68,
    height: 68,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  mainButton: {
    borderRadius: 12,
    marginTop: 6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 6,
  },
});
