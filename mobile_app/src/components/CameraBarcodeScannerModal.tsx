import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Text, IconButton, Button } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePreferences } from '../contexts/PreferencesContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}

export default function CameraBarcodeScannerModal({ visible, onClose, onScanned }: Props) {
  const { language } = usePreferences();
  const isBN = language === 'BN';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Reset scanned state whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);
    onScanned(data);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Close Button */}
          <View style={styles.topBar}>
            <Text style={styles.titleText}>
              {isBN ? '📷 বারকোড স্ক্যানার' : '📷 Barcode Scanner'}
            </Text>
            <IconButton icon="close" size={28} iconColor="#ffffff" onPress={onClose} />
          </View>

          {/* Camera View */}
          {permission && permission.granted ? (
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'qr',
                    'ean13',
                    'ean8',
                    'code128',
                    'code39',
                    'upc_a',
                    'upc_e',
                    'codabar',
                    'itf14'
                  ],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />

              {/* Viewfinder Target Box Overlay */}
              <View style={styles.maskContainer}>
                <View style={styles.maskTop} />
                <View style={styles.maskRow}>
                  <View style={styles.maskSide} />
                  <View style={styles.targetBox}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                    <View style={styles.scanLine} />
                  </View>
                  <View style={styles.maskSide} />
                </View>
                <View style={styles.maskBottom}>
                  <Text style={styles.guideText}>
                    {isBN ? 'বারকোডটি বক্সের মাঝে রাখুন' : 'Align barcode within the frame'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                {isBN ? 'বারকোড স্ক্যান করতে ক্যামেরা পারমিশন প্রয়োজন।' : 'Camera permission is required to scan barcodes.'}
              </Text>
              <Button mode="contained" buttonColor="#2563eb" onPress={requestPermission} style={{ marginTop: 16 }}>
                {isBN ? 'ক্যামেরা চালু করুন' : 'Grant Camera Permission'}
              </Button>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  maskContainer: {
    ...StyleSheet.absoluteFill,
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  maskRow: {
    flexDirection: 'row',
    height: 220,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  targetBox: {
    width: 280,
    height: 220,
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#3b82f6',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  maskBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 24,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
});
