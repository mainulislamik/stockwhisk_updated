import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity, Linking } from 'react-native';
import { Appbar, Card, Text, Button, Modal, Portal, ActivityIndicator, TextInput, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

interface Customer {
  id: number;
  name: string;
  phone: string;
  due_balance: string;
}

export default function DuesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [totalDues, setTotalDues] = useState('0');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchTotalDues();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchDues(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const fetchTotalDues = async () => {
    try {
      const res = await api.get('/crm/customers/dues-total/');
      setTotalDues(res.data.total || '0');
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDues = async (pageNum: number, searchQuery: string = '', reset: boolean = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const queryParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const res = await api.get(`/crm/customers/?with_due=1&page=${pageNum}&page_size=20${queryParam}`);
      const newCustomers = res.data.results || [];
      if (reset) {
        setCustomers(newCustomers);
      } else {
        setCustomers(prev => [...prev, ...newCustomers]);
      }
      setHasMore(!!res.data.next);
      setPage(pageNum + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isCloseToBottom && hasMore && !loading) {
      fetchDues(page, debouncedSearch);
    }
  };

  const handlePayment = async () => {
    if (!selectedCustomer || !amount) return;
    const payNum = Number(amount);
    const dueNum = Number(selectedCustomer.due_balance) || 0;
    if (isNaN(payNum) || payNum <= 0) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'সঠিক টাকার পরিমাণ দিন।' : 'Please enter a valid amount.');
      return;
    }
    if (payNum > dueNum) {
      Alert.alert(
        isBN ? 'ত্রুটি' : 'Error',
        isBN ? `টাকার পরিমাণ বর্তমান বকেয়া (৳${dueNum.toFixed(2)})-এর চেয়ে বেশি হতে পারে না।` : `Amount cannot exceed current due (৳${dueNum.toFixed(2)}).`
      );
      return;
    }
    setPaying(true);
    try {
      await api.post(`/crm/customers/${selectedCustomer.id}/receive-payment/`, {
        type: 'payment',
        amount,
        method,
        note
      });
      const custName = selectedCustomer.name;
      const custPhone = selectedCustomer.phone;
      const paidAmt = payNum.toFixed(2);
      const remainingDue = Math.max(0, dueNum - payNum).toFixed(2);

      setSelectedCustomer(null);
      setAmount('');
      setNote('');
      fetchTotalDues();
      fetchDues(1, true);

      if (custPhone) {
        Alert.alert(
          isBN ? 'পেমেন্ট সফল' : 'Payment Success',
          isBN ? `৳${paidAmt} বকেয়া পরিশোধ হয়েছে। অবশিষ্ট বকেয়া: ৳${remainingDue}।\nআপনি কি গ্রাহককে হোয়াটসঅ্যাপে মানি রিসিট পাঠাতে চান?` : `৳${paidAmt} due collected. Remaining: ৳${remainingDue}.\nSend WhatsApp money receipt?`,
          [
            { text: isBN ? 'না' : 'No', style: 'cancel' },
            {
              text: isBN ? 'হোয়াটসঅ্যাপে পাঠান' : 'Send WhatsApp',
              onPress: () => {
                const digits = custPhone.replace(/\D/g, '');
                const intl = digits.startsWith('880') ? digits : (digits.startsWith('01') ? `88${digits}` : digits);
                const msg = isBN
                  ? `মানি রিসিট (বকেয়া পরিশোধ)\n\nগ্রাহক: ${custName}\nআদায়কৃত টাকা: ৳${paidAmt}\nপরিশোধের মাধ্যম: ${method.toUpperCase()}\nঅবশিষ্ট বকেয়া: ৳${remainingDue}\nতারিখ: ${new Date().toLocaleDateString('en-GB')}\n\nধন্যবাদ!`
                  : `Money Receipt (Due Payment)\n\nCustomer: ${custName}\nAmount Paid: ৳${paidAmt}\nMethod: ${method.toUpperCase()}\nRemaining Due: ৳${remainingDue}\nDate: ${new Date().toLocaleDateString('en-GB')}\n\nThank you!`;
                Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`);
              }
            }
          ]
        );
      } else {
        Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'বকেয়া সফলভাবে গ্রহণ করা হয়েছে।' : 'Payment received successfully');
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.response?.data?.error || e.message || (isBN ? 'পেমেন্ট প্রসেস করতে সমস্যা হয়েছে।' : 'Failed to process payment');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', errMsg);
    } finally {
      setPaying(false);
    }
  };

  const PAYMENT_METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
    { key: 'bank_transfer', label: isBN ? 'ব্যাংক' : 'Bank' },
  ];

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'বকেয়া কালেকশন' : 'Due Collection'} titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>

      <Card style={{ margin: 16, backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderColor: '#fecaca', borderWidth: 1 }}>
        <Card.Content style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text variant="titleMedium" style={{ color: '#dc2626', fontWeight: 'bold' }}>
            {isBN ? 'মোট বকেয়া পাওনা' : 'Total Outstanding Dues'}
          </Text>
          <Text variant="displaySmall" style={{ color: '#dc2626', fontWeight: 'bold', marginTop: 4 }}>
            ৳{Number(totalDues || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </Card.Content>
      </Card>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'বকেয়া গ্রাহক খুঁজুন...' : 'Filter due customer...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ backgroundColor: theme.colors.surface }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {customers.map((c) => (
          <Card key={c.id} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} onPress={() => {
            setSelectedCustomer(c);
            setAmount(c.due_balance);
            setMethod('cash');
            setNote('');
          }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.name}</Text>
                  <Text variant="bodyMedium" style={{ color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant, marginTop: 2 }}>{c.phone || (isBN ? 'ফোন নম্বর নেই' : 'No phone')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="titleMedium" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    ৳{c.due_balance}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#4f46e5', marginTop: 4 }}>{isBN ? 'কালেক্ট করুন →' : 'Collect →'}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
        {loading && <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} />}
        {!loading && filteredCustomers.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color="#16a34a" />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {isBN ? 'কোনো বকেয়া পাওনা নেই!' : 'No outstanding dues!'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={!!selectedCustomer}
          onDismiss={() => setSelectedCustomer(null)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 460 }}
        >
          {selectedCustomer && (
            <View>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 4 }}>{isBN ? 'বকেয়া পেমেন্ট গ্রহণ' : 'Receive Payment'}</Text>
              <Text variant="bodyMedium" style={{ marginBottom: 16, color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant }}>
                {selectedCustomer.name} ({selectedCustomer.phone || 'N/A'})
              </Text>
              
              <TextInput
                mode="outlined"
                label={isBN ? 'টাকার পরিমাণ' : 'Amount'}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />
              <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>{isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                      borderWidth: 1, borderColor: method === m.key ? '#4f46e5' : '#ccc',
                      backgroundColor: method === m.key ? '#e0e7ff' : theme.colors.surface
                    }}
                  >
                    <Text style={{ fontSize: 12, color: method === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: method === m.key ? 'bold' : 'normal' }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                mode="outlined"
                label={isBN ? 'নোট (ঐচ্ছিক)' : 'Note (Optional)'}
                value={note}
                onChangeText={setNote}
                style={{ marginBottom: 20, backgroundColor: theme.colors.surface }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Button disabled={paying} onPress={() => setSelectedCustomer(null)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                <Button mode="contained" buttonColor="#4f46e5" loading={paying} disabled={paying} onPress={handlePayment}>
                  {isBN ? 'জমা দিন' : 'Submit'}
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}
