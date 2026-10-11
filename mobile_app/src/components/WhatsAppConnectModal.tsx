import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, Button, useTheme, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onConnected?: (phone?: string) => void;
}

export default function WhatsAppConnectModal({ visible, onDismiss, onConnected }: Props) {
  const theme = useTheme();
  const { language } = usePreferences();
  const isBN = language === 'BN';

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  const fetchQR = async () => {
    try {
      const res = await api.get('/notifications/whatsapp/qr/');
      const data = res.data;
      setStatus(data.status || 'unknown');

      if (data.connected) {
        Alert.alert(
          isBN ? 'সফল' : 'Success',
          data.phone
            ? (isBN ? `হোয়াটসঅ্যাপ কানেক্টেড: ${data.phone}` : `WhatsApp Connected: ${data.phone}`)
            : (isBN ? 'হোয়াটসঅ্যাপ সফলভাবে কানেক্টেড হয়েছে!' : 'WhatsApp connected successfully!')
        );
        if (onConnected) onConnected(data.phone || undefined);
        onDismiss();
        return;
      }

      if (data.qr) {
        setQrCode(data.qr);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }
    } catch (err: any) {
      setError(err?.message || (isBN ? 'QR কোড লোড হতে সমস্যা হচ্ছে।' : 'Failed to load QR'));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setQrCode(null);
      setLoading(true);
      setError(null);
      return;
    }

    fetchQR();
    pollTimerRef.current = setInterval(fetchQR, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [visible]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          margin: 20,
          padding: 20,
          borderRadius: 20,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <MaterialCommunityIcons name="whatsapp" size={30} color="#ffffff" />
        </View>

        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.onSurface, marginBottom: 4, textAlign: 'center' }}>
          {isBN ? 'হোয়াটসঅ্যাপ সংযোগ করুন' : 'Connect WhatsApp'}
        </Text>
        <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
          {isBN
            ? 'আপনার ফোনের WhatsApp অ্যাপ থেকে Linked Devices এ গিয়ে নিচের QR কোডটি স্ক্যান করুন।'
            : 'Scan this QR code from Linked Devices in your WhatsApp mobile app.'}
        </Text>

        <View
          style={{
            width: 230,
            height: 230,
            backgroundColor: '#ffffff',
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {loading ? (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={{ marginTop: 10, fontSize: 12, color: '#64748b', fontWeight: '700' }}>
                {isBN ? 'QR কোড তৈরি হচ্ছে...' : 'Generating QR Code...'}
              </Text>
            </View>
          ) : qrCode ? (
            <Image
              source={{ uri: qrCode }}
              style={{ width: 210, height: 210 }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>
                {error || (isBN ? 'QR প্রস্তুত হয়নি। পুনরায় চেষ্টা করুন।' : 'QR not available.')}
              </Text>
              <Button mode="outlined" compact onPress={fetchQR} style={{ marginTop: 8 }}>
                {isBN ? 'রিলোড' : 'Retry'}
              </Button>
            </View>
          )}
        </View>

        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <Button mode="text" onPress={onDismiss}>
            {isBN ? 'বন্ধ করুন' : 'Close'}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}
