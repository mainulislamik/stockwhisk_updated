import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Modal, Portal, Divider, useTheme } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

type Installment = {
  id: number;
  month_number: number;
  due_date: string;
  amount: string;
  paid_amount: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  paid_at: string | null;
};

type EMISchedule = {
  id: number;
  sale: number;
  sale_invoice_no: string;
  customer: number;
  customer_name: string;
  customer_phone?: string;
  total_principal: string;
  total_due: string;
  months: number;
  status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED';
  created_at: string;
  installments: Installment[];
};

export default function EMIScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [schedules, setSchedules] = useState<EMISchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<EMISchedule | null>(null);

  // Pay installment modal
  const [payInstallment, setPayInstallment] = useState<Installment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/emi/');
      const data = res.data.results || res.data || [];
      setSchedules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePayInstallment = async () => {
    if (!selectedSchedule || !payInstallment || !payAmount) return;
    setPaying(true);
    try {
      const res = await api.post(`/sales/emi/${selectedSchedule.id}/pay-installment/${payInstallment.id}/`, {
        amount: Number(payAmount),
        method: payMethod
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'কিস্তির টাকা সফলভাবে জমা হয়েছে!' : 'Installment payment recorded!');
      setPayInstallment(null);
      setPayAmount('');
      // update schedules
      fetchSchedules();
      if (res.data) setSelectedSchedule(res.data);
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || (isBN ? 'পেমেন্ট ব্যর্থ হয়েছে।' : 'Payment failed.'));
    } finally {
      setPaying(false);
    }
  };

  const handleSendReminder = (sched: EMISchedule, inst: Installment) => {
    const phone = sched.customer_phone || '';
    const digits = phone.replace(/\D/g, '');
    const intl = digits.startsWith('880') ? digits : (digits.startsWith('01') ? `88${digits}` : digits);
    const remaining = (Number(inst.amount) - Number(inst.paid_amount || 0)).toFixed(2);

    const instNum = (inst as any).installment_number ?? inst.month_number ?? 1;
    const msg = isBN
      ? `প্রিয় ${sched.customer_name},\n\nআপনার ইনভয়েস #${sched.sale_invoice_no} এর কিস্তি #${instNum} এর বকেয়া ৳${remaining}। পরিশোধের শেষ তারিখ: ${inst.due_date}।\n\nধন্যবাদ!`
      : `Dear ${sched.customer_name},\n\nYour EMI installment #${instNum} for invoice #${sched.sale_invoice_no} due amount is ৳${remaining}. Due date: ${inst.due_date}.\n\nThank you!`;

    Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`);
  };

  const METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
    { key: 'bank_transfer', label: isBN ? 'ব্যাংক' : 'Bank' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <PageGuideButton pageKey="/app/emi" />
        <Appbar.Content title={isBN ? 'ইএমআই ও কিস্তি ব্যবস্থাপনা' : 'EMI Management'} titleStyle={{ fontWeight: 'bold' }} />
        <Appbar.Action icon="refresh" onPress={fetchSchedules} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {schedules.map((sched) => (
            <Card key={sched.id} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} onPress={() => setSelectedSchedule(sched)}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>#{sched.sale_invoice_no || sched.sale}</Text>
                  <View style={{
                    backgroundColor: sched.status === 'COMPLETED' ? '#16a34a' : '#4f46e5',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}>
                      {sched.status === 'COMPLETED' ? (isBN ? 'সম্পন্ন' : 'COMPLETED') : (isBN ? 'চলমান' : 'ACTIVE')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', marginTop: 4 }}>{sched.customer_name || (isBN ? 'গ্রাহক' : 'Customer')}</Text>
                
                <Divider style={{ marginVertical: 8 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text variant="bodySmall" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'মোট কিস্তি:' : 'Months:'} {sched.months}</Text>
                    <Text style={{ fontWeight: 'bold', marginTop: 2 }}>{isBN ? 'আসল:' : 'Principal:'} ৳{Number(sched.total_principal || 0).toFixed(2)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="bodySmall" style={{ color: '#dc2626' }}>{isBN ? 'বাকি কিস্তি:' : 'Remaining Due:'}</Text>
                    <Text style={{ fontWeight: 'bold', color: '#dc2626', fontSize: 15, marginTop: 2 }}>
                      ৳{Number(sched.total_due || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
          {!loading && schedules.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar-check" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
              <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                {isBN ? 'কোনো সক্রিয় ইএমআই নেই' : 'No active EMI schedules found'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Schedule Detail & Installments Modal */}
      <Portal>
        <Modal
          visible={!!selectedSchedule}
          onDismiss={() => setSelectedSchedule(null)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 16,
            padding: 20,
            borderRadius: 12,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 480,
            maxHeight: '85%'
          }}
        >
          {selectedSchedule && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>#{selectedSchedule.sale_invoice_no}</Text>
                <View style={{
                  backgroundColor: selectedSchedule.status === 'COMPLETED' ? '#16a34a' : '#4f46e5',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: 12,
                    textAlign: 'center',
                    includeFontPadding: false,
                    lineHeight: 16,
                  }}>
                    {selectedSchedule.status === 'COMPLETED' ? (isBN ? 'সম্পন্ন' : 'COMPLETED') : (isBN ? 'চলমান' : 'ACTIVE')}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 15, fontWeight: '600', marginBottom: 4 }}>{selectedSchedule.customer_name}</Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginBottom: 8 }}>
                {isBN ? 'বাকি পরিমাণ:' : 'Remaining Due:'} ৳{Number(selectedSchedule.total_due || 0).toFixed(2)}
              </Text>

              <Divider style={{ marginVertical: 10 }} />

              <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
                {isBN ? 'মাসিক কিস্তির তালিকা' : 'Installment Schedule'}
              </Text>

              {selectedSchedule.installments?.map((inst) => {
                const isPaid = inst.status === 'PAID';
                return (
                  <View key={inst.id} style={{ padding: 10, borderRadius: 8, marginBottom: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: isPaid ? '#16a34a' : '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: 'bold' }}>{isBN ? `কিস্তি #${inst.month_number}` : `Month #${inst.month_number}`}</Text>
                      <View style={{
                        backgroundColor: isPaid ? '#16a34a' : inst.status === 'PARTIAL' ? '#ea580c' : '#dc2626',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 50,
                      }}>
                        <Text style={{
                          color: '#ffffff',
                          fontSize: 10,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          includeFontPadding: false,
                        }}>
                          {inst.status === 'PAID' ? (isBN ? 'পরিশোধিত' : 'PAID') : inst.status === 'PARTIAL' ? (isBN ? 'আংশিক' : 'PARTIAL') : (isBN ? 'বকেয়া' : 'UNPAID')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'তারিখ:' : 'Due Date:'} {inst.due_date}</Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 13 }}>৳{Number(inst.amount).toFixed(2)}</Text>
                    </View>

                    {!isPaid && (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        {selectedSchedule.customer_phone && (
                          <Button mode="text" compact textColor="#25D366" icon="whatsapp" onPress={() => handleSendReminder(selectedSchedule, inst)}>
                            {isBN ? 'রিমাইন্ডার' : 'Reminder'}
                          </Button>
                        )}
                        <Button mode="contained" compact buttonColor="#4f46e5" onPress={() => {
                          setPayInstallment(inst);
                          const remaining = Number(inst.amount) - Number(inst.paid_amount || 0);
                          setPayAmount(remaining.toString());
                        }}>
                          {isBN ? 'কিস্তি জমা দিন' : 'Pay'}
                        </Button>
                      </View>
                    )}
                  </View>
                );
              })}

              <Button mode="outlined" style={{ marginTop: 12 }} onPress={() => setSelectedSchedule(null)}>
                {isBN ? 'বন্ধ করুন' : 'Close'}
              </Button>
            </ScrollView>
          )}
        </Modal>

        {/* Pay Installment Modal */}
        <Modal
          visible={!!payInstallment}
          onDismiss={() => setPayInstallment(null)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 420 }}
        >
          {payInstallment && (
            <View>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 12 }}>
                {isBN ? `কিস্তি #${payInstallment.month_number} জমা গ্রহণ` : `Pay Installment #${payInstallment.month_number}`}
              </Text>
              
              <TextInput
                mode="outlined"
                label={isBN ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                {isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setPayMethod(m.key)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                      borderWidth: 1, borderColor: payMethod === m.key ? '#4f46e5' : '#ccc',
                      backgroundColor: payMethod === m.key ? '#e0e7ff' : theme.colors.surface
                    }}
                  >
                    <Text style={{ fontSize: 12, color: payMethod === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: payMethod === m.key ? 'bold' : 'normal' }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Button disabled={paying} onPress={() => setPayInstallment(null)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                <Button mode="contained" buttonColor="#4f46e5" loading={paying} disabled={paying || !payAmount} onPress={handlePayInstallment}>
                  {isBN ? 'জমা নিশ্চিত করুন' : 'Confirm Payment'}
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}
