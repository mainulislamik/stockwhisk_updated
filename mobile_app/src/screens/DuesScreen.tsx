import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { Appbar, Card, Text, Button, Modal, Portal, ActivityIndicator, TextInput, useTheme, SegmentedButtons } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
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

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  due_balance: string;
  due_date?: string;
}

export default function DuesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');

  // Customer state
  const [totalCustomerDues, setTotalCustomerDues] = useState('0');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custPage, setCustPage] = useState(1);
  const [custLoading, setCustLoading] = useState(false);
  const [custHasMore, setCustHasMore] = useState(true);

  // Supplier state
  const [totalSupplierDues, setTotalSupplierDues] = useState('0');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppLoading, setSuppLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAllTotals();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'customer') {
      fetchCustomerDues(1, debouncedSearch, true);
    } else {
      fetchSupplierDues(debouncedSearch);
    }
  }, [debouncedSearch, activeTab]);

  const fetchAllTotals = async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        api.get('/crm/customers/dues-total/').catch(() => ({ data: { total: '0' } })),
        api.get('/purchasing/suppliers/dues-total/').catch(() => ({ data: { total: 0 } })),
      ]);
      setTotalCustomerDues(custRes.data?.total || '0');
      setTotalSupplierDues(String(suppRes.data?.total || '0'));
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllTotals();
    if (activeTab === 'customer') {
      await fetchCustomerDues(1, debouncedSearch, true);
    } else {
      await fetchSupplierDues(debouncedSearch);
    }
    setRefreshing(false);
  };

  const fetchCustomerDues = async (pageNum: number, searchQuery: string = '', reset: boolean = false) => {
    if (custLoading || (!custHasMore && !reset)) return;
    setCustLoading(true);
    try {
      const queryParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const res = await api.get(`/crm/customers/?with_due=1&page=${pageNum}&page_size=20${queryParam}`);
      const newCustomers = res.data.results || [];
      if (reset) {
        setCustomers(newCustomers);
      } else {
        setCustomers(prev => [...prev, ...newCustomers]);
      }
      setCustHasMore(!!res.data.next);
      setCustPage(pageNum + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setCustLoading(false);
    }
  };

  const fetchSupplierDues = async (searchQuery: string = '') => {
    setSuppLoading(true);
    try {
      const queryParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const res = await api.get(`/purchasing/suppliers/?with_due=1&page_size=100${queryParam}`);
      const list = res.data.results || res.data || [];
      setSuppliers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setSuppLoading(false);
    }
  };

  const handleCustScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeTab !== 'customer') return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isCloseToBottom && custHasMore && !custLoading) {
      fetchCustomerDues(custPage, debouncedSearch);
    }
  };

  const handleCustomerPayment = async () => {
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
    setSubmitting(true);
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
      fetchAllTotals();
      fetchCustomerDues(1, debouncedSearch, true);

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
      setSubmitting(false);
    }
  };

  const handleSupplierPayment = async () => {
    if (!selectedSupplier || !amount) return;
    const payNum = Number(amount);
    const dueNum = Number(selectedSupplier.due_balance) || 0;
    if (isNaN(payNum) || payNum <= 0) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'সঠিক টাকার পরিমাণ দিন।' : 'Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        amount,
        method,
        note: note.trim()
      };
      if (nextDueDate) {
        payload.due_date = nextDueDate;
      }
      await api.post(`/purchasing/suppliers/${selectedSupplier.id}/pay-due/`, payload);

      const paidAmt = payNum.toFixed(2);
      const remainingDue = Math.max(0, dueNum - payNum).toFixed(2);

      setSelectedSupplier(null);
      setAmount('');
      setNote('');
      setNextDueDate('');
      fetchAllTotals();
      fetchSupplierDues(debouncedSearch);

      Alert.alert(
        isBN ? 'পেমেন্ট সফল' : 'Payment Success',
        isBN ? `সাপ্লায়ারকে ৳${paidAmt} প্রদান করা হয়েছে। অবশিষ্ট দেনা: ৳${remainingDue}।` : `Paid ৳${paidAmt} to supplier. Remaining due: ৳${remainingDue}.`
      );
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.response?.data?.error || e.message || (isBN ? 'সাপ্লায়ার পেমেন্ট ব্যর্থ হয়েছে।' : 'Failed to pay supplier');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', errMsg);
    } finally {
      setSubmitting(false);
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

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.includes(search))
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'বকেয়া ও দেনা খাতা' : 'Dues & Payables'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/dues" />
      </Appbar.Header>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={v => setActiveTab(v as 'customer' | 'supplier')}
          buttons={[
            {
              value: 'customer',
              label: isBN ? 'কাস্টমার বকেয়া' : 'Customer Dues',
              icon: 'account-arrow-left',
            },
            {
              value: 'supplier',
              label: isBN ? 'সাপ্লায়ার দেনা' : 'Supplier Payables',
              icon: 'truck-delivery',
            },
          ]}
        />
      </View>

      {/* Summary Total Card */}
      {activeTab === 'customer' ? (
        <Card style={{ marginHorizontal: 16, marginVertical: 8, backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderColor: '#fecaca', borderWidth: 1 }}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text variant="titleSmall" style={{ color: '#dc2626', fontWeight: 'bold' }}>
              {isBN ? '👤 মোট কাস্টমার বকেয়া পাওনা (Receivable)' : 'Total Customer Receivable'}
            </Text>
            <Text variant="headlineMedium" style={{ color: '#dc2626', fontWeight: 'bold', marginTop: 2 }}>
              ৳{Number(totalCustomerDues || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <Card style={{ marginHorizontal: 16, marginVertical: 8, backgroundColor: isDarkMode ? '#1e1b4b' : '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1 }}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text variant="titleSmall" style={{ color: '#2563eb', fontWeight: 'bold' }}>
              {isBN ? '🏢 মোট সাপ্লায়ার প্রদেয় দেনা (Payable)' : 'Total Supplier Payables'}
            </Text>
            <Text variant="headlineMedium" style={{ color: '#2563eb', fontWeight: 'bold', marginTop: 2 }}>
              ৳{Number(totalSupplierDues || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Search Input */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TextInput
          mode="outlined"
          placeholder={activeTab === 'customer' ? (isBN ? 'গ্রাহক খুঁজুন (নাম বা ফোন)...' : 'Filter customer...') : (isBN ? 'সরবরাহকারী খুঁজুন...' : 'Filter supplier...')}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ backgroundColor: theme.colors.surface }}
        />
      </View>

      {/* Main List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        onScroll={handleCustScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'customer' ? (
          <>
            {customers.map((c) => (
              <Card key={c.id} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} onPress={() => {
                setSelectedCustomer(c);
                setAmount(c.due_balance);
                setMethod('cash');
                setNote('');
              }}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.name}</Text>
                      <Text variant="bodyMedium" style={{ color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {c.phone || (isBN ? 'ফোন নম্বর নেই' : 'No phone')}
                      </Text>
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
            {custLoading && <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} />}
            {!custLoading && filteredCustomers.length === 0 && (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#16a34a" />
                <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  {isBN ? 'কোনো কাস্টমার বকেয়া নেই!' : 'No customer dues!'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {suppliers.map((s) => (
              <Card key={s.id} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} onPress={() => {
                setSelectedSupplier(s);
                setAmount(s.due_balance);
                setMethod('cash');
                setNote('');
                setNextDueDate(s.due_date || '');
              }}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{s.name}</Text>
                      <Text variant="bodyMedium" style={{ color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {s.phone ? `📞 ${s.phone}` : (isBN ? 'ফোন নম্বর নেই' : 'No phone')}
                      </Text>
                      {s.due_date && (
                        <Text style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
                          📅 {isBN ? 'পরিশোধের তারিখ:' : 'Due Date:'} {s.due_date}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="titleMedium" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                        ৳{s.due_balance}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#2563eb', marginTop: 4, fontWeight: 'bold' }}>
                        {isBN ? 'দেনা পরিশোধ →' : 'Pay Due →'}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
            {suppLoading && <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} />}
            {!suppLoading && filteredSuppliers.length === 0 && (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#16a34a" />
                <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  {isBN ? 'দোকানের কোনো সাপ্লায়ার দেনা নেই!' : 'No supplier payables!'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Customer Payment Modal */}
      <Portal>
        <Modal
          visible={!!selectedCustomer}
          onDismiss={() => setSelectedCustomer(null)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 460 }}
        >
          {selectedCustomer && (
            <View>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {isBN ? 'বকেয়া পেমেন্ট গ্রহণ (Customer)' : 'Receive Payment'}
              </Text>
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
              <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
                {isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              </Text>
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
                <Button disabled={submitting} onPress={() => setSelectedCustomer(null)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                <Button mode="contained" buttonColor="#4f46e5" loading={submitting} disabled={submitting} onPress={handleCustomerPayment}>
                  {isBN ? 'জমা দিন' : 'Submit'}
                </Button>
              </View>
            </View>
          )}
        </Modal>

        {/* Supplier Payment Modal */}
        <Modal
          visible={!!selectedSupplier}
          onDismiss={() => setSelectedSupplier(null)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 460 }}
        >
          {selectedSupplier && (
            <View>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 4, color: '#2563eb' }}>
                {isBN ? 'সাপ্লায়ার দেনা পরিশোধ (Pay Supplier)' : 'Pay Supplier Due'}
              </Text>
              <Text variant="bodyMedium" style={{ marginBottom: 12, color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant }}>
                {selectedSupplier.name} {selectedSupplier.phone ? `(${selectedSupplier.phone})` : ''}
              </Text>
              <Text style={{ fontSize: 13, marginBottom: 14, color: '#dc2626', fontWeight: 'bold' }}>
                {isBN ? 'বর্তমান প্রদেয় দেনা:' : 'Current Due:'} ৳{selectedSupplier.due_balance}
              </Text>
              
              <TextInput
                mode="outlined"
                label={isBN ? 'পরিশোধিত টাকার পরিমাণ' : 'Payment Amount'}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />

              <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
                {isBN ? 'পরিশোধের মাধ্যম' : 'Payment Method'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                      borderWidth: 1, borderColor: method === m.key ? '#2563eb' : '#ccc',
                      backgroundColor: method === m.key ? '#dbeafe' : theme.colors.surface
                    }}
                  >
                    <Text style={{ fontSize: 12, color: method === m.key ? '#2563eb' : theme.colors.onSurface, fontWeight: method === m.key ? 'bold' : 'normal' }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                mode="outlined"
                label={isBN ? 'পরবর্তী বাকি পরিশোধের তারিখ (YYYY-MM-DD)' : 'Next Promised Date (YYYY-MM-DD)'}
                value={nextDueDate}
                onChangeText={setNextDueDate}
                placeholder="2026-11-20"
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />

              <TextInput
                mode="outlined"
                label={isBN ? 'নোট / ভাউচার রেফারেন্স' : 'Note / Voucher Ref'}
                value={note}
                onChangeText={setNote}
                style={{ marginBottom: 20, backgroundColor: theme.colors.surface }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Button disabled={submitting} onPress={() => setSelectedSupplier(null)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                <Button mode="contained" buttonColor="#2563eb" loading={submitting} disabled={submitting} onPress={handleSupplierPayment}>
                  {isBN ? 'দেনা পরিশোধ করুন' : 'Confirm Payment'}
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}
