import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Surface,
  Divider,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as SecureStore from '../utils/storage';
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Load saved email on mount
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const savedEmail = await SecureStore.getItemAsync(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setLoginEmail(savedEmail);
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
    try {
      const res = await api.post('/auth/token/', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      const { access, refresh } = res.data;
      if (access && refresh) {
        if (rememberMe) {
          await SecureStore.setItemAsync(REMEMBER_EMAIL_KEY, loginEmail.trim().toLowerCase());
        } else {
          await SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY);
        }
        await login(access, refresh);
      } else {
        setError(isBN ? 'লগইন ব্যর্থ হয়েছে। টোকেন পাওয়া যায়নি।' : 'Login failed: Invalid token received.');
      }
    } catch (e: any) {
      const serverMsg = e.response?.data?.detail || e.response?.data?.error;
      if (serverMsg) {
        setError(serverMsg);
      } else if (e.message?.includes('Network') || e.message?.includes('network')) {
        setError(isBN ? 'সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি। ইন্টারনেট কানেকশন চেক করুন।' : 'Network connection error. Please check your internet.');
      } else {
        setError(isBN ? 'ব্যবহারকারীর নাম বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Invalid credentials. Please try again.');
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
    if (signupPassword.length < 8) {
      setError(isBN ? 'পাসওয়ার্ড ন্যূনতম ৮ অক্ষরের হতে হবে।' : 'Password must be at least 8 characters.');
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

  // 3. Handle Forgot Password: Step 2 (Submit New Password)
  const handleResetPassword = async () => {
    if (!forgotOtp.trim()) {
      setError(isBN ? 'ওটিপি কোড লিখুন।' : 'Please enter the reset OTP.');
      return;
    }
    if (newPassword.length < 6) {
      setError(isBN ? 'নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isBN ? 'পাসওয়ার্ড দুটি মেলেনি।' : 'Passwords do not match.');
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
    { key: 'general', icon: 'storefront-outline', label: isBN ? 'সাধারণ রিটেইল শপ' : 'General Retail' },
    { key: 'clothing', icon: 'tshirt-crew-outline', label: isBN ? 'গার্মেন্টস ও ফ্যাশন' : 'Clothing & Fashion' },
    { key: 'electronics', icon: 'cellphone-link', label: isBN ? 'ইলেকট্রনিক্স ও গ্যাজেট' : 'Electronics & Gadgets' },
    { key: 'grocery', icon: 'cart-outline', label: isBN ? 'মুদি ও সুপারশপ' : 'Grocery & Superstore' },
    { key: 'cosmetics', icon: 'lipstick', label: isBN ? 'কসমেটিকস ও বিউটি' : 'Cosmetics & Beauty' },
    { key: 'pharmacy', icon: 'pill', label: isBN ? 'ফার্মেসি ও ড্রাগ' : 'Pharmacy' },
    { key: 'camical', icon: 'flask-outline', label: isBN ? 'কেমিক্যাল ও ল্যাব' : 'Chemical & Lab' },
    { key: 'service', icon: 'wrench-outline', label: isBN ? 'মেরামত ও সার্ভিসিং' : 'Repair & Service' },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDarkMode ? '#090d16' : '#f8fafc' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Floating App Bar */}
        <View style={styles.topBar}>
          {mode !== 'login' ? (
            <TouchableOpacity
              onPress={() => switchMode('login')}
              style={[styles.backButton, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color="#2563eb" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563eb', marginLeft: 4 }}>
                {isBN ? 'লগইন' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={toggleLanguage}
              style={[styles.topPill, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}
            >
              <MaterialCommunityIcons name="translate" size={16} color="#2563eb" />
              <Text style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 5, color: '#2563eb' }}>
                {isBN ? 'English' : 'বাংলা'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleDarkMode}
              style={[styles.topPill, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingHorizontal: 10 }]}
            >
              <MaterialCommunityIcons
                name={isDarkMode ? 'weather-sunny' : 'weather-night'}
                size={16}
                color={isDarkMode ? '#fbbf24' : '#64748b'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onSurface, marginTop: 10, textAlign: 'center' }}>
              {mode === 'login' && (isBN ? 'স্বাগতম' : 'Welcome Back')}
              {mode === 'signup' && (isBN ? 'নতুন দোকান রেজিস্টার' : 'Create Free Account')}
              {mode === 'forgot' && (isBN ? 'পাসওয়ার্ড রিসেট' : 'Reset Password')}
            </Text>
            <Text variant="bodySmall" style={{ color: '#64748b', marginTop: 4, textAlign: 'center', lineHeight: 18 }}>
              {mode === 'login' && (isBN ? 'ইনভেন্টরি ও সেলস পরিচালনা করতে লগইন করুন' : 'Sign in to manage your retail POS & inventory')}
              {mode === 'signup' && (isBN ? 'কয়েকটি সহজ ধাপে আপনার ডিজিটাল শপ শুরু করুন' : 'Start your cloud POS & inventory in 2 simple steps')}
              {mode === 'forgot' && (isBN ? 'ইমেইলে ওটিপি কোড দিয়ে নতুন পাসওয়ার্ড সেট করুন' : 'Verify your email with OTP to reset password')}
            </Text>
          </View>

          {/* Feedback Messages */}
          {error ? (
            <Surface style={[styles.alertContainer, { backgroundColor: isDarkMode ? '#450a0a' : '#fee2e2' }]} elevation={0}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={{ color: isDarkMode ? '#fca5a5' : '#b91c1c', fontSize: 13, flex: 1, fontWeight: '500' }}>{error}</Text>
            </Surface>
          ) : null}

          {success ? (
            <Surface style={[styles.alertContainer, { backgroundColor: isDarkMode ? '#052e16' : '#dcfce7' }]} elevation={0}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#16a34a" style={{ marginRight: 8 }} />
              <Text style={{ color: isDarkMode ? '#86efac' : '#15803d', fontSize: 13, flex: 1, fontWeight: '500' }}>{success}</Text>
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
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
                left={<TextInput.Icon icon="email-outline" color="#2563eb" />}
              />

              <TextInput
                label={isBN ? 'পাসওয়ার্ড' : 'Password'}
                value={loginPassword}
                onChangeText={setLoginPassword}
                mode="outlined"
                secureTextEntry={!showLoginPassword}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
                left={<TextInput.Icon icon="lock-outline" color="#2563eb" />}
                right={
                  <TextInput.Icon
                    icon={showLoginPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                  />
                }
              />

              <View style={styles.switchRow}>
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <MaterialCommunityIcons
                    name={rememberMe ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={rememberMe ? '#2563eb' : '#94a3b8'}
                  />
                  <Text style={{ fontSize: 13, color: '#64748b', marginLeft: 6 }}>
                    {isBN ? 'মনে রাখুন' : 'Remember me'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => switchMode('forgot')}>
                  <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '600' }}>
                    {isBN ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
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
                  <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: 'bold' }}>
                    ✨ {isBN ? 'নতুন অ্যাকাউন্ট তৈরি করুন (Sign Up)' : 'Create Free Account (Sign Up)'}
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
              {/* Modern Step Indicator */}
              <View style={styles.stepContainer}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, { backgroundColor: '#2563eb' }]}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>1</Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: '#2563eb', fontWeight: '700' }]}>
                    {isBN ? 'দোকানের তথ্য' : 'Shop Details'}
                  </Text>
                </View>

                <View style={[styles.stepLine, { backgroundColor: signupStep === 2 ? '#2563eb' : '#e2e8f0' }]} />

                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, { backgroundColor: signupStep === 2 ? '#2563eb' : (isDarkMode ? '#334155' : '#cbd5e1') }]}>
                    <Text style={{ color: signupStep === 2 ? '#fff' : '#64748b', fontSize: 12, fontWeight: '800' }}>2</Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: signupStep === 2 ? '#2563eb' : '#94a3b8', fontWeight: signupStep === 2 ? '700' : '500' }]}>
                    {isBN ? 'ওটিপি যাচাই' : 'OTP Verify'}
                  </Text>
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
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="store-outline" color="#2563eb" />}
                  />

                  <TextInput
                    label={isBN ? 'মালিকের নাম *' : 'Owner Name *'}
                    value={ownerName}
                    onChangeText={setOwnerName}
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="account-outline" color="#2563eb" />}
                  />

                  <TextInput
                    label={isBN ? 'মোবাইল নম্বর *' : 'Phone Number *'}
                    value={signupPhone}
                    onChangeText={setSignupPhone}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="phone-outline" color="#2563eb" />}
                  />

                  <TextInput
                    label={isBN ? 'ইমেইল অ্যাড্রেস *' : 'Email Address *'}
                    value={signupEmail}
                    onChangeText={setSignupEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="email-outline" color="#2563eb" />}
                  />

                  <TextInput
                    label={isBN ? 'পাসওয়ার্ড (ন্যূনতম ৮ অক্ষর) *' : 'Password (min 8 chars) *'}
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    mode="outlined"
                    secureTextEntry={!showSignupPassword}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-outline" color="#2563eb" />}
                    right={
                      <TextInput.Icon
                        icon={showSignupPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowSignupPassword(!showSignupPassword)}
                      />
                    }
                  />

                  {/* Business Type Selector Grid */}
                  <View style={{ marginTop: 6, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 }}>
                      {isBN ? '🏪 ব্যবসার ধরন নির্বাচন করুন' : '🏪 Select Business Category'}
                    </Text>
                    <View style={styles.categoryGrid}>
                      {BUSINESS_TYPES.map(b => {
                        const isSelected = businessType === b.key;
                        return (
                          <TouchableOpacity
                            key={b.key}
                            onPress={() => setBusinessType(b.key)}
                            activeOpacity={0.7}
                            style={[
                              styles.categoryCard,
                              {
                                borderColor: isSelected ? '#2563eb' : (isDarkMode ? '#334155' : '#e2e8f0'),
                                backgroundColor: isSelected
                                  ? (isDarkMode ? '#1e3a8a' : '#eff6ff')
                                  : (isDarkMode ? '#1e293b' : '#f8fafc'),
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={b.icon as any}
                              size={18}
                              color={isSelected ? '#2563eb' : (isDarkMode ? '#94a3b8' : '#64748b')}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 12,
                                fontWeight: isSelected ? '700' : '500',
                                color: isSelected ? '#2563eb' : theme.colors.onSurface,
                                marginLeft: 6,
                                flexShrink: 1,
                              }}
                            >
                              {b.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <TextInput
                    label={isBN ? 'রেফারেল কোড (ঐচ্ছিক)' : 'Referral Code (Optional)'}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    mode="outlined"
                    autoCapitalize="characters"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="gift-outline" color="#2563eb" />}
                  />

                  <Button
                    mode="contained"
                    buttonColor="#2563eb"
                    onPress={handleInitiateSignup}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 8 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'ওটিপি কোড পাঠান ➜' : 'Send Verification OTP ➜'}
                  </Button>
                </View>
              )}

              {/* Step 2: Verify OTP */}
              {signupStep === 2 && (
                <View>
                  <View style={{ backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', padding: 14, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#2563eb' }}>
                    <Text style={{ fontSize: 13, color: isDarkMode ? '#bfdbfe' : '#1e40af', textAlign: 'center', lineHeight: 20 }}>
                      {isBN
                        ? `✉️ আমরা ${signupEmail} ঠিকানায় ৬-ডিজিটের একটি ভেরিফিকেশন কোড পাঠিয়েছি।`
                        : `✉️ We sent a 6-digit verification code to ${signupEmail}.`}
                    </Text>
                  </View>

                  <TextInput
                    label={isBN ? '৬-ডিজিট ওটিপি কোড' : '6-Digit OTP Code'}
                    value={signupOtp}
                    onChangeText={setSignupOtp}
                    mode="outlined"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { textAlign: 'center', fontSize: 22, letterSpacing: 6 }]}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="shield-key-outline" color="#2563eb" />}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: '#64748b' }}>
                      ⏳ {isBN ? 'মেয়াদ বাকি:' : 'Expires in:'} {formatSeconds(signupTimer)}
                    </Text>
                    {signupTimer === 0 ? (
                      <TouchableOpacity onPress={handleInitiateSignup} disabled={loading}>
                        <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 'bold' }}>
                          {isBN ? 'পুনরায় কোড পাঠান' : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Button
                    mode="contained"
                    buttonColor="#2563eb"
                    onPress={handleVerifySignupOtp}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 8 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'যাচাই করুন ও শুরু করুন 🎉' : 'Verify & Launch Shop 🎉'}
                  </Button>

                  <Button mode="text" textColor="#2563eb" onPress={() => setSignupStep(1)} style={{ marginTop: 8 }}>
                    {isBN ? '← তথ্য পরিবর্তন করুন' : '← Edit Information'}
                  </Button>
                </View>
              )}

              <Divider style={{ marginVertical: 18 }} />

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {isBN ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : 'Already have an account?'}
                </Text>
                <TouchableOpacity onPress={() => switchMode('login')} style={{ marginTop: 6, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: 'bold' }}>
                    {isBN ? 'লগইন করুন (Sign In)' : 'Sign In to Account'}
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
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="email-outline" color="#2563eb" />}
                  />

                  <Button
                    mode="contained"
                    buttonColor="#2563eb"
                    onPress={handleRequestForgotOtp}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 8 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'রিসেট কোড পাঠান ➜' : 'Send Reset Code ➜'}
                  </Button>
                </View>
              )}

              {/* Step 2: Submit New Password */}
              {forgotStep === 2 && (
                <View>
                  <View style={{ backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', padding: 14, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#2563eb' }}>
                    <Text style={{ fontSize: 13, color: isDarkMode ? '#bfdbfe' : '#1e40af', textAlign: 'center', lineHeight: 20 }}>
                      {isBN
                        ? `✉️ আমরা ${forgotEmail} ঠিকানায় ৬-ডিজিটের একটি পাসওয়ার্ড রিসেট কোড পাঠিয়েছি।`
                        : `✉️ We sent a 6-digit reset code to ${forgotEmail}.`}
                    </Text>
                  </View>

                  <TextInput
                    label={isBN ? '৬-ডিজিট ওটিপি কোড' : '6-Digit OTP Code'}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    mode="outlined"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 4 }]}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="shield-key-outline" color="#2563eb" />}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, color: '#64748b' }}>
                      ⏳ {isBN ? 'মেয়াদ বাকি:' : 'Expires in:'} {formatSeconds(forgotTimer)}
                    </Text>
                    {forgotTimer === 0 ? (
                      <TouchableOpacity onPress={handleRequestForgotOtp} disabled={loading}>
                        <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 'bold' }}>
                          {isBN ? 'পুনরায় কোড পাঠান' : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TextInput
                    label={isBN ? 'নতুন পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)' : 'New Password (min 6 chars)'}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    mode="outlined"
                    secureTextEntry={!showNewPassword}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-outline" color="#2563eb" />}
                    right={
                      <TextInput.Icon
                        icon={showNewPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      />
                    }
                  />

                  <TextInput
                    label={isBN ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    mode="outlined"
                    secureTextEntry={!showNewPassword}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                    left={<TextInput.Icon icon="lock-check-outline" color="#2563eb" />}
                  />

                  <Button
                    mode="contained"
                    buttonColor="#2563eb"
                    onPress={handleResetPassword}
                    loading={loading}
                    disabled={loading}
                    style={styles.mainButton}
                    contentStyle={{ paddingVertical: 8 }}
                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  >
                    {isBN ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Update Password'}
                  </Button>

                  <Button mode="text" textColor="#2563eb" onPress={() => setForgotStep(1)} style={{ marginTop: 8 }}>
                    {isBN ? '← ইমেইল পরিবর্তন করুন' : '← Change Email'}
                  </Button>
                </View>
              )}

              <Divider style={{ marginVertical: 18 }} />

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
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    width: '100%',
  },
  topBar: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent',
    fontSize: 14,
  },
  inputOutline: {
    borderRadius: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  mainButton: {
    borderRadius: 12,
    marginTop: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 11,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
