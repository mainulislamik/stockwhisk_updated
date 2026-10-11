import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Switch, useTheme, Divider } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';

export default function WhatsAppScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [config, setConfig] = useState<any>({});
  const [testSending, setTestSending] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/whatsapp/config/');
      setConfig(res.data || {});
      if (res.data?.connected_phone && !testPhone) {
        setTestPhone(res.data.connected_phone);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      isBN ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnect',
      isBN ? 'আপনি কি WhatsApp সংযোগ বিচ্ছিন্ন করতে চান?' : 'Do you want to disconnect WhatsApp session?',
      [
        { text: isBN ? 'না' : 'No', style: 'cancel' },
        {
          text: isBN ? 'হ্যাঁ, বিচ্ছিন্ন করুন' : 'Yes, Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/notifications/whatsapp/disconnect/');
              Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'WhatsApp সংযোগ বিচ্ছিন্ন করা হয়েছে।' : 'Disconnected successfully.');
              fetchConfig();
            } catch (e: any) {
              Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'বিচ্ছিন্ন করা যায়নি।' : 'Disconnect failed.');
            }
          },
        },
      ]
    );
  };

  const handleSaveToggle = async (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try {
      await api.patch('/notifications/whatsapp/config/', { [key]: value });
    } catch (e) {
      console.error(e);
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'সেটিংস আপডেট ব্যর্থ হয়েছে।' : 'Failed to update setting.');
    }
  };

  const handleSendTestReport = async () => {
    setTestSending(true);
    try {
      const res = await api.post('/notifications/whatsapp/test-owner-report/', {
        phone: testPhone.trim() || undefined,
      });
      Alert.alert(
        isBN ? 'সফল' : 'Success',
        isBN
          ? 'টেস্ট ডাইজেস্ট সফলভাবে আপনার হোয়াটসঅ্যাপে পাঠানো হয়েছে!'
          : 'Test daily digest sent successfully to your WhatsApp!'
      );
    } catch (e: any) {
      const msg = e?.response?.data?.detail || (isBN ? 'রিপোর্ট পাঠানো ব্যর্থ হয়েছে' : 'Failed to send test report');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', String(msg));
    } finally {
      setTestSending(false);
    }
  };

  const isConnected = !!config.is_connected;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'হোয়াটসঅ্যাপ সংযোগ ও ডাইজেস্ট' : 'WhatsApp Automation'} />
        <Appbar.Action icon="refresh" onPress={fetchConfig} />
        <PageGuideButton pageKey="/app/settings/whatsapp" />
      </Appbar.Header>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#25D366" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
          {/* Status Card */}
          <Card
            style={{
              marginBottom: 16,
              borderRadius: 16,
              backgroundColor: isConnected ? '#f0fdf4' : '#f8fafc',
              borderWidth: 1.5,
              borderColor: isConnected ? '#22c55e' : '#cbd5e1',
            }}
          >
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isConnected ? '#22c55e' : '#94a3b8',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons name="whatsapp" size={30} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isConnected ? '#15803d' : '#334155' }}>
                    {isConnected
                      ? (isBN ? 'WhatsApp সংযুক্ত ও সক্রিয়' : 'WhatsApp Connected & Active')
                      : (isBN ? 'WhatsApp সংযুক্ত নেই' : 'WhatsApp Not Connected')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>
                    {isConnected
                      ? `${config.connected_phone || ''} ${config.connected_name ? `(${config.connected_name})` : ''}`
                      : (isBN ? 'সরাসরি ইনভয়েস ও অ্যালার্ট পাঠাতে কিউআর কোড স্ক্যান করুন।' : 'Scan QR code to enable 1-tap alerts.')}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                {isConnected ? (
                  <Button
                    mode="outlined"
                    textColor="#ef4444"
                    icon="link-off"
                    onPress={handleDisconnect}
                    style={{ flex: 1, borderColor: '#ef4444' }}
                  >
                    {isBN ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    buttonColor="#25D366"
                    icon="qrcode-scan"
                    onPress={() => setShowQRModal(true)}
                    style={{ flex: 1 }}
                  >
                    {isBN ? 'QR কোড স্ক্যান করুন' : 'Scan QR Code'}
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Nightly Executive Digest Section */}
          <Card
            style={{
              marginBottom: 16,
              borderRadius: 16,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
            }}
          >
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <MaterialCommunityIcons name="clock-time-ten" size={24} color="#6366f1" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.onSurface }}>
                  🌙 {isBN ? 'রাত ১০:০০টার অটো ডাইজেস্ট রিপোর্ট' : 'Nightly 10 PM Briefing'}
                </Text>
              </View>

              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                {isBN
                  ? 'প্রতিদিন রাত ১০টায় স্বয়ংক্রিয়ভাবে দোকানের মোট বিক্রয়, নগদ কালেকশন, বকেয়া ও খরচের বিস্তারিত সারাংশ মালিকের হোয়াটসঅ্যাপে পৌঁছে যায়।'
                  : 'Automated 10:00 PM executive digest summarizing sales, collections, and dues sent to shop owner.'}
              </Text>

              <Divider style={{ marginVertical: 8 }} />

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 }}>
                  {isBN ? 'মালিকের হোয়াটসঅ্যাপ নম্বর:' : 'Owner WhatsApp Number:'}
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="017xxxxxxxx"
                  value={testPhone}
                  onChangeText={setTestPhone}
                  keyboardType="phone-pad"
                  style={{ backgroundColor: theme.colors.surface }}
                  dense
                />
              </View>

              <Button
                mode="contained"
                buttonColor="#6366f1"
                icon="send"
                onPress={handleSendTestReport}
                loading={testSending}
                disabled={testSending}
              >
                {isBN ? 'টেস্ট ডাইজেস্ট রিপোর্ট পাঠান' : 'Send Test Briefing'}
              </Button>
            </Card.Content>
          </Card>

          {/* Preferences & POS Auto-Send */}
          <Card
            style={{
              marginBottom: 16,
              borderRadius: 16,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
            }}
          >
            <Card.Content>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.onSurface, marginBottom: 12 }}>
                ⚙️ {isBN ? 'অটোমেশন সেটিংস' : 'Automation Preferences'}
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.onSurface }}>
                    {isBN ? 'বিক্রয়ের পর স্বয়ংক্রিয় ইনভয়েস' : 'Auto Send Invoice on Sale'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>
                    {isBN ? 'POS এ বিক্রি সম্পন্ন হলে সাথে সাথে কাস্টমারের হোয়াটসঅ্যাপে মেমো যাবে' : 'Dispatch invoice automatically to customer WhatsApp'}
                  </Text>
                </View>
                <Switch
                  value={!!config.auto_send_pos}
                  onValueChange={(val) => handleSaveToggle('auto_send_pos', val)}
                  color="#25D366"
                />
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      <WhatsAppConnectModal
        visible={showQRModal}
        onDismiss={() => setShowQRModal(false)}
        onConnected={(phone) => {
          fetchConfig();
        }}
      />
    </View>
  );
}
