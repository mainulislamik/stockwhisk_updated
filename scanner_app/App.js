import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, 
  ActivityIndicator, StatusBar, Image, SafeAreaView, Platform, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_WIDTH = 280;
const SCAN_HEIGHT = 180;
// We roughly center the box. Adjust top offset if header is big.
const SCAN_LEFT = (SCREEN_WIDTH - SCAN_WIDTH) / 2;
const SCAN_TOP = (SCREEN_HEIGHT - SCAN_HEIGHT) / 2;

const API_BASE = "https://stockwhisk.com/api"; 

export default function App() {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const lastScannedRef = useRef({ data: null, time: 0 });
  const [isInitializing, setIsInitializing] = useState(true);
  const [shopName, setShopName] = useState('');

  // ── Helper: Authenticated API request with automatic token refresh ────────
  const requestWithAuth = async (url, options = {}) => {
    let currentToken = token;
    let savedRefresh = refreshToken;
    if (!currentToken) {
      currentToken = await AsyncStorage.getItem('token');
    }
    if (!savedRefresh) {
      savedRefresh = await AsyncStorage.getItem('refreshToken');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      'Authorization': `Bearer ${currentToken}`,
    };

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (netErr) {
      return { ok: false, status: 0, error: 'Network error: Please check your internet connection.' };
    }

    // If 401 (Expired token), attempt automatic token refresh
    if (response.status === 401 && savedRefresh) {
      try {
        const refreshResp = await fetch(`${API_BASE}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: savedRefresh }),
        });

        if (refreshResp.ok) {
          const refreshData = await refreshResp.json();
          if (refreshData.access) {
            setToken(refreshData.access);
            await AsyncStorage.setItem('token', refreshData.access);
            
            // Retry the original request with the fresh access token
            const retryHeaders = {
              ...headers,
              'Authorization': `Bearer ${refreshData.access}`,
            };
            const retryResp = await fetch(url, { ...options, headers: retryHeaders });
            const retryData = await retryResp.json().catch(() => ({}));
            return { ok: retryResp.ok, status: retryResp.status, data: retryData };
          }
        }
      } catch (refErr) {
        console.error('Token refresh request failed', refErr);
      }

      // Refresh failed or token permanently revoked
      await handleLogout();
      Alert.alert('Session Expired', 'Your login session has expired. Please sign in again.');
      return { ok: false, status: 401, error: 'Session expired. Please sign in again.' };
    }

    const resData = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data: resData };
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedRefresh = await AsyncStorage.getItem('refreshToken');
        const savedShopId = await AsyncStorage.getItem('shopId');
        const savedEmail = await AsyncStorage.getItem('email');
        const savedShopName = await AsyncStorage.getItem('shopName');
        if (savedToken && savedShopId) {
          setToken(savedToken);
          setRefreshToken(savedRefresh);
          setShopId(savedShopId);
          if (savedEmail) setEmail(savedEmail);
          
          if (savedShopName) {
            setShopName(savedShopName);
          } else {
            // Auto-fetch if missing from old session
            try {
              const meResp = await fetch(`${API_BASE}/auth/me/`, {
                headers: { 'Authorization': `Bearer ${savedToken}` }
              });
              if (meResp.ok) {
                const meData = await meResp.json();
                const fetchedShopName = meData.shop_name || "My Shop";
                setShopName(fetchedShopName);
                await AsyncStorage.setItem('shopName', fetchedShopName);
              }
            } catch(e) {
              console.error(e);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load session');
      } finally {
        setIsInitializing(false);
      }
    };
    loadSession();
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('shopId');
      await AsyncStorage.removeItem('shopName');
      // Intentionally keeping the email stored so it prefills the login screen
    } catch (e) {
      console.error('Failed to clear session');
    }
    setToken(null);
    setRefreshToken(null);
    setShopId(null);
    setShopName('');
    setIsScanning(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.access) {
        let finalShopName = "My Shop";
        try {
          const meResp = await fetch(`${API_BASE}/auth/me/`, {
            headers: { 'Authorization': `Bearer ${data.access}` }
          });
          if (meResp.ok) {
            const meData = await meResp.json();
            finalShopName = meData.shop_name || "My Shop";
          }
        } catch(e) {
          console.error("Failed to fetch shop name");
        }

        const newShopId = data.shop_id || 1;
        setToken(data.access);
        setRefreshToken(data.refresh || null);
        setShopId(newShopId); 
        setShopName(finalShopName);
        setIsScanning(false); 
        try {
          await AsyncStorage.setItem('token', data.access);
          if (data.refresh) {
            await AsyncStorage.setItem('refreshToken', data.refresh);
          }
          await AsyncStorage.setItem('shopId', String(newShopId));
          await AsyncStorage.setItem('email', email.trim().toLowerCase());
          await AsyncStorage.setItem('shopName', finalShopName);
        } catch (e) {
          console.error('Failed to save session');
        }
      } else {
        Alert.alert('Login Failed', data.detail || data.error || 'Invalid email or password.');
      }
    } catch (error) {
      Alert.alert('Connection Error', error.message || 'Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async (event) => {
    const { type, data, bounds } = event;

    // Check if barcode is within the box (if platform provides bounds)
    if (bounds && bounds.origin) {
      const { x, y } = bounds.origin;
      const { width, height } = bounds.size || { width: 0, height: 0 };
      
      const barcodeCenterX = x + (width / 2);
      const barcodeCenterY = y + (height / 2);
      const padding = 30; // 30px forgiveness

      if (
        barcodeCenterX < SCAN_LEFT - padding ||
        barcodeCenterX > SCAN_LEFT + SCAN_WIDTH + padding ||
        barcodeCenterY < SCAN_TOP - padding ||
        barcodeCenterY > SCAN_TOP + SCAN_HEIGHT + padding
      ) {
        return; // Ignore scans outside the box
      }
    }

    const now = Date.now();
    const last = lastScannedRef.current;
    
    if (last.data === data) {
      // If same barcode, require them to look away for at least 2.5 seconds
      if (now - last.time < 2500) {
        lastScannedRef.current = { data, time: now };
        return; 
      }
    }

    lastScannedRef.current = { data, time: now };
    setScanned(true);

    try {
      const result = await requestWithAuth(`${API_BASE}/scanner/scan/`, {
        method: 'POST',
        body: JSON.stringify({ barcode: String(data).trim() }),
      });

      if (!result.ok) {
        const errorMsg = result.data?.detail || result.data?.error || result.error || 'Failed to send barcode to server.';
        Alert.alert('Scan Failed', errorMsg);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to communicate with server.');
    } finally {
      setLoading(false);
    }
    setTimeout(() => setScanned(false), 1000);
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  // 1. Login Screen
  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb" />
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.logoContainer}>
              <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.subtitle}>POS Scanner App</Text>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Dashboard Screen
  if (!isScanning) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb" />
        <View style={styles.container}>
          
          <View style={styles.header}>
            <Image source={require('./assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
            <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.dashboardContent}>
            <View style={styles.userBadge}>
              <Ionicons name="storefront-outline" size={20} color="#6b7280" />
              <Text style={styles.userBadgeText}>{shopName || email}</Text>
            </View>

            <Text style={styles.welcomeText}>Ready to scan!</Text>
            <Text style={styles.subText}>Tap the button below to open the camera and scan barcodes directly into your POS.</Text>
            
            <TouchableOpacity style={styles.scanCard} onPress={() => setIsScanning(true)}>
              <View style={styles.scanIconWrapper}>
                <Ionicons name="barcode-outline" size={64} color="#ffffff" />
              </View>
              <Text style={styles.scanCardTitle}>Start Scanner</Text>
              <Text style={styles.scanCardSubtitle}>Grid Scan Mode</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // 3. Camera Screen Permissions
  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Ionicons name="camera-outline" size={48} color="#6b7280" style={{alignSelf: 'center', marginBottom: 15}} />
            <Text style={styles.permissionText}>We need your permission to show the camera for scanning barcodes.</Text>
            
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsScanning(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Camera View
  return (
    <View style={styles.cameraContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <CameraView
        style={styles.camera}
        facing="back"
        autofocus="on"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          
          <View style={styles.overlayTop}>
            <SafeAreaView>
              <View style={styles.cameraHeader}>
                <TouchableOpacity style={styles.backButton} onPress={() => setIsScanning(false)}>
                  <Ionicons name="close-outline" size={28} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>Scan Barcode</Text>
                <View style={{ width: 44 }} /> 
              </View>
            </SafeAreaView>
          </View>
          
          <View style={styles.overlayRow}>
            <View style={styles.overlaySide} />
            <View style={styles.transparentScanBox}>
              <View style={[styles.frameCorner, styles.topLeft]} />
              <View style={[styles.frameCorner, styles.topRight]} />
              <View style={[styles.frameCorner, styles.bottomLeft]} />
              <View style={[styles.frameCorner, styles.bottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>

          <View style={styles.overlayBottom}>
            {scanned && (
              <SafeAreaView>
                <View style={styles.sendingBadge}>
                  <ActivityIndicator size="small" color="#ffffff" style={{marginRight: 8}} />
                  <Text style={styles.sendingText}>Sending...</Text>
                </View>
              </SafeAreaView>
            )}
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 70,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 20,
    left: 24,
    right: 24,
  },
  headerLogo: {
    width: 140,
    height: 45,
  },
  logoutIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#fee2e2',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  userBadgeText: {
    fontSize: 13,
    color: '#4b5563',
    marginLeft: 6,
    fontWeight: '500',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 12,
  },
  subText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
    lineHeight: 22,
  },
  scanCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    aspectRatio: 1,
    maxWidth: 300,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#ecfdf5',
  },
  scanIconWrapper: {
    width: 100,
    height: 100,
    backgroundColor: '#10b981',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  scanCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  scanCardSubtitle: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  permissionText: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayRow: {
    flexDirection: 'row',
    height: SCAN_HEIGHT,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  transparentScanBox: {
    width: SCAN_WIDTH,
    height: SCAN_HEIGHT,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  frameCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10b981', 
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },
  sendingBadge: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  sendingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
