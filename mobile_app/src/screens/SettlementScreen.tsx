import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Divider, useTheme, Modal, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

type Settlement = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: string;
  expected_cash: string;
  actual_cash: string;
  discrepancy: string;
  total_sales: string;
  total_expenses: string;
  total_refunds: string;
  status: 'open' | 'closed';
  closed_by_name: string | null;
};

export default function SettlementScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [current, setCurrent] = useState<Settlement | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Open / Close shift modal states
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        api.get('/accounting/daily-settlements/current/').catch(() => ({ data: null })),
        api.get('/accounting/daily-settlements/').catch(() => ({ data: { results: [] } }))
      ]);
      setCurrent(curRes.data || null);
      const results = histRes.data.results || histRes.data || [];
      setHistory(results.filter((s: Settlement) => s.status === 'closed'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    setSubmitting(true);
    try {
      await api.post('/accounting/daily-settlements/open/', {
        opening_cash: Number(openingCash) || 0
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন শিফট / ক্যাশ ড্রয়ার চালু হয়েছে।' : 'Shift opened successfully!');
      setOpenModalVisible(false);
      setOpeningCash('0');
      fetchData();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || (isBN ? 'শিফট ওপেন করতে সমস্যা হয়েছে।' : 'Failed to open shift.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCloseShift = async () => {
    setSubmitting(true);
    try {
      await api.post('/accounting/daily-settlements/close/', {
        actual_cash: actualCash
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'দিনশেষে হিসাব বন্ধ সম্পন্ন হয়েছে!' : 'Daily settlement closed successfully!');
      setCloseModalVisible(false);
      setActualCash('');
      fetchData();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || (isBN ? 'ক্লোজ করতে সমস্যা হয়েছে।' : 'Failed to close shift.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!actualCash) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'ড্রয়ারে থাকা মোট নগদ টাকার পরিমাণ লিখুন।' : 'Please enter actual cash in drawer.');
      return;
    }
    const entered = Number(actualCash) || 0;
    const expected = Number(current?.expected_cash) || 0;
    const diff = entered - expected;
    if (Math.abs(diff) > 0.01) {
      const diffStr = Math.abs(diff).toFixed(2);
      const msg = diff < 0
        ? (isBN ? `ড্রয়ারের ক্যাশে ৳${diffStr} ঘাটতি (Shortage) রয়েছে। আপনি কি নিশ্চিত যে হিসাব বন্ধ করতে চান?` : `There is a cash shortage of ৳${diffStr}. Are you sure you want to close?`)
        : (isBN ? `ড্রয়ারের ক্যাশে ৳${diffStr} উদ্বৃত্ত (Surplus) রয়েছে। আপনি কি নিশ্চিত যে হিসাব বন্ধ করতে চান?` : `There is a cash surplus of ৳${diffStr}. Are you sure you want to close?`);
      Alert.alert(
        isBN ? 'ক্যাশ অমিল সতর্কতা' : 'Cash Discrepancy Warning',
        msg,
        [
          { text: isBN ? 'পুনরায় গণনা করুন' : 'Recount', style: 'cancel' },
          { text: isBN ? 'হাঁ, বন্ধ করুন' : 'Confirm Close', onPress: submitCloseShift }
        ]
      );
      return;
    }
    submitCloseShift();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} elevated style={{ backgroundColor: isDarkMode ? theme.colors.surface : '#ffffff', zIndex: 10 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content 
          title={
            <Text style={{ fontWeight: 'bold', fontSize: 18 }} adjustsFontSizeToFit numberOfLines={1}>
              {isBN ? 'দৈনিক হিসাব ও ক্যাশ ক্লোজিং' : 'Daily Settlement'}
            </Text>
          } 
        />
        <Appbar.Action icon="refresh" onPress={fetchData} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Current Status Banner */}
          {current ? (
            <Card style={{ backgroundColor: theme.colors.surface, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#4f46e5' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a', marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a' }}>
                    {isBN ? 'বর্তমান শিফট চালু আছে (OPEN)' : 'Current Shift is OPEN'}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: isDarkMode ? '#334155' : '#e2e8f0',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary, includeFontPadding: false }}>
                    #{current.id}
                  </Text>
                </View>
              </View>

              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginBottom: 12 }}>
                {isBN ? 'চালুর সময়:' : 'Opened at:'} {new Date(current.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>

              <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 8, gap: 6, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'ওপেনিং ক্যাশ:' : 'Opening Cash:'}</Text>
                  <Text style={{ fontWeight: '600' }}>৳{Number(current.opening_cash || 0).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'মোট ক্যাশ বিক্রয়:' : 'Total Sales:'}</Text>
                  <Text style={{ fontWeight: '600', color: '#16a34a' }}>+ ৳{Number(current.total_sales || 0).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'মোট খরচ:' : 'Total Expenses:'}</Text>
                  <Text style={{ fontWeight: '600', color: '#dc2626' }}>- ৳{Number(current.total_expenses || 0).toFixed(2)}</Text>
                </View>
                <Divider style={{ marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{isBN ? 'ড্রয়ারে প্রত্যাশিত ক্যাশ:' : 'Expected Cash:'}</Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#4f46e5' }}>
                    ৳{Number(current.expected_cash || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              <Button mode="contained" buttonColor="#dc2626" icon="lock-check" onPress={() => setCloseModalVisible(true)}>
                {isBN ? 'দিনশেষে ক্যাশ ক্লোজ করুন' : 'Close Day / Settle'}
              </Button>
            </Card>
          ) : (
            <Card style={{ backgroundColor: theme.colors.surface, padding: 20, alignItems: 'center', marginBottom: 16 }}>
              <MaterialCommunityIcons name="cash-register" size={48} color="#64748b" style={{ marginBottom: 12 }} />
              <Text style={{ fontWeight: 'bold', fontSize: 17, marginBottom: 6 }}>
                {isBN ? 'ক্যাশ ড্রয়ার বন্ধ আছে' : 'No Open Shift'}
              </Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', textAlign: 'center', marginBottom: 16 }}>
                {isBN ? 'আজকের বিক্রয় ও লেনদেন ট্র্যাক করতে একটি নতুন শিফট চালু করুন।' : 'Open a new register shift to start tracking cash sales today.'}
              </Text>
              <Button mode="contained" buttonColor="#16a34a" icon="lock-open-outline" onPress={() => setOpenModalVisible(true)}>
                {isBN ? 'নতুন শিফট চালু করুন' : 'Open Register Shift'}
              </Button>
            </Card>
          )}

          {/* Past Settlements History */}
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>
            {isBN ? 'বিগত দিনের সেটেলমেন্ট ইতিহাস' : 'Settlement History'}
          </Text>

          {history.map((s) => {
            const disc = Number(s.discrepancy || 0);
            return (
              <Card key={s.id} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
                      {new Date(s.opened_at).toLocaleDateString()}
                    </Text>
                    <View style={{
                      backgroundColor: isDarkMode ? '#334155' : '#64748b',
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 24,
                    }}>
                      <Text style={{
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}>
                        {isBN ? 'বন্ধ' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>{isBN ? 'প্রত্যাশিত:' : 'Expected:'} ৳{Number(s.expected_cash).toFixed(2)}</Text>
                    <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>{isBN ? 'প্রাপ্ত নগদ:' : 'Actual:'} ৳{Number(s.actual_cash).toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 13 }}>{isBN ? 'পার্থক্য (Variance):' : 'Variance:'}</Text>
                    <Text style={{ fontWeight: 'bold', color: disc === 0 ? '#16a34a' : disc > 0 ? '#16a34a' : '#dc2626' }}>
                      {disc > 0 ? `+৳${disc.toFixed(2)}` : disc < 0 ? `-৳${Math.abs(disc).toFixed(2)}` : '৳0.00'}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Open Shift Modal */}
      <Portal>
        <Modal
          visible={openModalVisible}
          onDismiss={() => setOpenModalVisible(false)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 420 }}
        >
          <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 12 }}>
            {isBN ? 'শিফট ওপেন করুন' : 'Open Register Shift'}
          </Text>
          <TextInput
            mode="outlined"
            label={isBN ? 'ওপেনিং ক্যাশ ব্যালেন্স (৳)' : 'Opening Cash (৳)'}
            value={openingCash}
            onChangeText={setOpeningCash}
            keyboardType="numeric"
            style={{ marginBottom: 20, backgroundColor: theme.colors.surface }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={submitting} onPress={() => setOpenModalVisible(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
            <Button mode="contained" buttonColor="#16a34a" loading={submitting} disabled={submitting} onPress={handleOpenShift}>
              {isBN ? 'চালু করুন' : 'Open Shift'}
            </Button>
          </View>
        </Modal>

        {/* Close Shift Modal */}
        <Modal
          visible={closeModalVisible}
          onDismiss={() => setCloseModalVisible(false)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 420 }}
        >
          <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 6 }}>
            {isBN ? 'ক্যাশ ক্লোজিং ও সেটেলমেন্ট' : 'Close Day / Settlement'}
          </Text>
          <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginBottom: 16 }}>
            {isBN ? `প্রত্যাশিত ক্যাশ: ৳${Number(current?.expected_cash || 0).toFixed(2)}` : `Expected Cash: ৳${Number(current?.expected_cash || 0).toFixed(2)}`}
          </Text>

          <TextInput
            mode="outlined"
            label={isBN ? 'ড্রয়ারে থাকা মোট ক্যাশ (৳) *' : 'Actual Cash in Drawer (৳) *'}
            value={actualCash}
            onChangeText={setActualCash}
            keyboardType="numeric"
            style={{ marginBottom: 20, backgroundColor: theme.colors.surface }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={submitting} onPress={() => setCloseModalVisible(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
            <Button mode="contained" buttonColor="#dc2626" loading={submitting} disabled={submitting || !actualCash} onPress={handleCloseShift}>
              {isBN ? 'ক্লোজ করুন' : 'Confirm Close'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
