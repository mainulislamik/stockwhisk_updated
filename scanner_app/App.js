import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
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

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleLogin = async () => {
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

  if (!token) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>StockWhisk Scanner</Text>
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

  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
      />
      {scanned && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Sending...</Text>
        </View>
      )}
      <View style={styles.bottomBar}>
         <Button title="Logout" onPress={() => setToken(null)} color="#ef4444" />
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827',
  },
  input: {
    height: 50,
    borderColor: '#d1d5db',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'white',
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
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  }
});
