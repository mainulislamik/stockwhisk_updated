import React, { useState } from 'react';
import { View, Modal, StyleSheet, Platform, Alert, Dimensions, Vibration, Linking } from 'react-native';
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
  const [torchOn, setTorchOn] = useState(false);

  // Reset scanned state whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchOn(false);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);
    try {
      Vibration.vibrate(70);
    } catch (e) {}
    onScanned(data);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Bar Controls */}
          <View style={styles.topBar}>
            <Text style={styles.titleText}>
              {isBN ? '📷 বারকোড স্ক্যানার' : '📷 Barcode Scanner'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton
                icon={torchOn ? 'flashlight' : 'flashlight-off'}
                size={24}
                iconColor={torchOn ? '#fbbf24' : '#ffffff'}
                onPress={() => setTorchOn(!torchOn)}
              />
              <IconButton icon="close" size={26} iconColor="#ffffff" onPress={onClose} />
            </View>
          </View>

          {/* Camera View */}
          {permission && permission.granted ? (
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
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
                    'itf14',
                  ],
                }}
                onBarcodeScanned={scanned ? undefined : (handleBarcodeScanned as any)}
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
                    {isBN ? 'বারকোডটি লাল লাইনের মাঝে রাখুন' : 'Align barcode within the target box'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                {isBN
                  ? 'বারকোড স্ক্যান করতে ক্যামেরা পারমিশন প্রয়োজন।'
                  : 'Camera permission is required to scan product barcodes.'}
              </Text>
              <Button
                mode="contained"
                buttonColor="#4f46e5"
                onPress={requestPermission}
                style={{ marginTop: 16 }}
              >
                {isBN ? 'ক্যামেরা চালু করুন' : 'Grant Camera Permission'}
              </Button>
              <Button
                mode="outlined"
                textColor="#ffffff"
                onPress={() => Linking.openSettings()}
                style={{ marginTop: 10, borderColor: '#64748b' }}
              >
                {isBN ? '⚙️ ফোন সেটিংসে গিয়ে পারমিশন দিন' : '⚙️ Open Phone Settings'}
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
    backgroundColor: 'rgba(0,0,0,0.95)',
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
    zIndex: 30,
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
    width: 26,
    height: 26,
    borderColor: '#4f46e5',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 4 },
  scanLine: {
    width: '92%',
    height: 2,
    backgroundColor: '#ef4444',
  },
  maskBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 24,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontWeight: '600',
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
    lineHeight: 24,
  },
});
