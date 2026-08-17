import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_BASE = "https://stockwhisk.com/api"; 

export default function App() {
  const [token, setToken] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  // New state to toggle between Dashboard and Camera
  const [isScanning, setIsScanning] = useState(false);

  // Removed the useEffect that caused an infinite permission request loop

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
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data.access) {
        setToken(data.access);
        setShopId(data.shop_id || 1); // fallback
        setIsScanning(false); // Make sure we start at the dashboard
      } else {
        Alert.alert('Login Failed', data.detail || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    try {
      const response = await fetch(`${API_BASE}/scanner/scan/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ barcode: data }),
      });
      if (!response.ok) {
        Alert.alert('Scan Error', 'Failed to send barcode to server.');
      }
    } catch (e) {
      Alert.alert('Network Error', e.message);
    }
    // Resume scanning after 1 second
    setTimeout(() => setScanned(false), 1000);
  };

  // 1. Login Screen
  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {loading ? <ActivityIndicator size="large" color="#2563eb" /> : <Button title="Login" onPress={handleLogin} color="#2563eb" />}
      </View>
    );
  }

  // 2. Dashboard Screen (after login, before scanning)
  if (!isScanning) {
    return (
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.welcomeText}>You are logged in.</Text>
        
        <TouchableOpacity style={styles.scanButton} onPress={() => setIsScanning(true)}>
          <Text style={styles.scanButtonText}>Start Grid Scan</Text>
        </TouchableOpacity>
        
        <View style={styles.spacer} />
        <Button title="Logout" onPress={() => setToken(null)} color="#ef4444" />
      </View>
    );
  }

  // 3. Camera Screen
  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera.</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
        <View style={{ marginTop: 20 }}>
           <Button title="Go Back" onPress={() => setIsScanning(false)} color="#6b7280" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
      />
      
      {/* Top overlay to go back */}
      <View style={styles.topBar}>
        <Button title="Back to Home" onPress={() => setIsScanning(false)} color="#374151" />
      </View>

      {/* Sending Indicator */}
      {scanned && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Sending...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 250,
    height: 80,
  },
  welcomeText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#374151',
  },
  scanButton: {
    backgroundColor: '#10b981',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spacer: {
    height: 30,
  },
  input: {
    height: 50,
    borderColor: '#d1d5db',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 20,
  },
  overlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
  },
});
