import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity, Linking, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Appbar, TextInput, Card, Text, Button, ActivityIndicator, Divider, useTheme, FAB } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  due_balance: string;
  total_purchased: string;
}

export default function CustomersScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  
  // Payment state
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);

  // Add Customer state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCustomers(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const fetchCustomers = async (pageNum: number, searchQuery: string, reset: boolean = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const res = await api.get(`/crm/customers/?search=${encodeURIComponent(searchQuery)}&page=${pageNum}&page_size=20`);
      const newCustomers = res.data.results || [];
      if (reset) {
        setCustomers(newCustomers);
      } else {
        setCustomers(prev => [...prev, ...newCustomers]);
      }
      setHasMore(!!res.data.next);
      setPage(pageNum);
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
      fetchCustomers(page + 1, search);
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
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।' : 'Payment received successfully');
      setPaymentModalVisible(false);
      setSelectedCustomer(null);
      setAmount('');
      setNote('');
      fetchCustomers(1, search, true);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.response?.data?.error || e.message || (isBN ? 'পেমেন্ট প্রসেস করতে সমস্যা হয়েছে।' : 'Failed to process payment');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', errMsg);
    } finally {
      setPaying(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCust.name.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'গ্রাহকের নাম আবশ্যক।' : 'Customer name is required.');
      return;
    }
    setAddingCustomer(true);
    try {
      await api.post('/crm/customers/', newCust);
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন গ্রাহক যুক্ত হয়েছে।' : 'Customer added successfully!');
      setShowAddModal(false);
      setNewCust({ name: '', phone: '', email: '', address: '' });
      fetchCustomers(1, search, true);
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || (isBN ? 'গ্রাহক যুক্ত করতে ব্যর্থ হয়েছে।' : 'Failed to add customer.'));
    } finally {
      setAddingCustomer(false);
    }
  };

  const PAYMENT_METHODS = [
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
        <Appbar.Content title={isBN ? 'গ্রাহক তালিকা' : 'Customers'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/customers" />
        <Appbar.Action icon="plus" onPress={() => setShowAddModal(true)} />
      </Appbar.Header>
      
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'গ্রাহকের নাম বা মোবাইল খুঁজুন...' : 'Search customers by name or phone...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {customers.map((c) => (
          <Card key={c.id} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} onPress={() => setSelectedCustomer(c)}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.name}</Text>
                  <Text variant="bodyMedium" style={{ color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant, marginTop: 2 }}>{c.phone || (isBN ? 'ফোন নম্বর নেই' : 'No phone')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyMedium">{isBN ? 'মোট ক্রয়:' : 'Total:'} ৳{c.total_purchased || '0'}</Text>
                  {Number(c.due_balance) > 0 && (
                    <Text variant="labelLarge" style={{ color: '#dc2626', fontWeight: 'bold', marginTop: 4 }}>
                      {isBN ? 'বকেয়া:' : 'Due:'} ৳{c.due_balance}
                    </Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
        {loading && <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} />}
        {!loading && customers.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="account-off-outline" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'কোনো গ্রাহক পাওয়া যায়নি' : 'No customers found'}</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB for Adding Customer */}
      <FAB
        icon="plus"
        color="#fff"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#4f46e5' }}
        onPress={() => setShowAddModal(true)}
      />

      {/* Customer Detail & Pay Modal */}
      <Modal visible={!!selectedCustomer} transparent animationType="fade" onRequestClose={() => { if (!paymentModalVisible) setSelectedCustomer(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => { if (!paymentModalVisible) setSelectedCustomer(null); }}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!paymentModalVisible && selectedCustomer && (
                    <View>
                      <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 12 }}>{selectedCustomer.name}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ফোন:' : 'Phone:'} {selectedCustomer.phone || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ইমেইল:' : 'Email:'} {selectedCustomer.email || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ঠিকানা:' : 'Address:'} {selectedCustomer.address || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'মোট ক্রয়:' : 'Total Spend:'} ৳{selectedCustomer.total_purchased || '0'}</Text>
                      <Divider style={{ marginVertical: 12 }} />
                      <Text variant="bodyLarge" style={{ color: Number(selectedCustomer.due_balance) > 0 ? '#dc2626' : undefined, fontWeight: 'bold', marginTop: 4 }}>
                        {isBN ? 'বকেয়া ব্যালেন্স:' : 'Due Balance:'} ৳{selectedCustomer.due_balance || '0'}
                      </Text>
                      {!!selectedCustomer.phone && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                          <Button mode="contained-tonal" icon="phone" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${selectedCustomer.phone}`)}>
                            {isBN ? 'কল করুন' : 'Call'}
                          </Button>
                          <Button mode="contained" icon="whatsapp" buttonColor="#25D366" textColor="#fff" style={{ flex: 1 }} onPress={() => {
                              const digits = selectedCustomer.phone.replace(/\D/g, "");
                              const intl = digits.startsWith("880") ? digits : (digits.startsWith("01") ? `88${digits}` : digits);
                              Linking.openURL(`https://wa.me/${intl}`);
                            }}>
                            WhatsApp
                          </Button>
                        </View>
                      )}
                      <Button mode="outlined" icon="receipt" style={{ marginTop: 12 }} onPress={() => {
                          const cust = selectedCustomer;
                          setSelectedCustomer(null);
                          (navigation as any).navigate('Sales', { search: cust.phone || cust.name });
                        }}>
                        {isBN ? 'পূর্বের চালানসমূহ দেখুন' : 'View Purchase Invoices'}
                      </Button>
                      <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button mode="outlined" onPress={() => setSelectedCustomer(null)}>{isBN ? 'বন্ধ করুন' : 'Close'}</Button>
                        {Number(selectedCustomer.due_balance) > 0 && (
                          <Button mode="contained" buttonColor="#4f46e5" onPress={() => {
                            setAmount(selectedCustomer.due_balance);
                            setPaymentModalVisible(true);
                          }}>
                            {isBN ? 'বকেয়া গ্রহণ করুন' : 'Receive Payment'}
                          </Button>
                        )}
                      </View>
                    </View>
                  )}

                  {paymentModalVisible && selectedCustomer && (
                    <View>
                      <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>{isBN ? 'বকেয়া পেমেন্ট গ্রহণ' : 'Receive Payment'}</Text>
                      <TextInput mode="outlined" label={isBN ? 'টাকার পরিমাণ' : 'Amount'} value={amount} onChangeText={setAmount} keyboardType="numeric" style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} />
                      <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>{isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {PAYMENT_METHODS.map(m => (
                          <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: method === m.key ? '#4f46e5' : '#ccc', backgroundColor: method === m.key ? '#e0e7ff' : theme.colors.surface }}>
                            <Text style={{ fontSize: 12, color: method === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: method === m.key ? 'bold' : 'normal' }}>{m.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput mode="outlined" label={isBN ? 'নোট (ঐচ্ছিক)' : 'Note (Optional)'} value={note} onChangeText={setNote} style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button disabled={paying} onPress={() => setPaymentModalVisible(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                        <Button mode="contained" buttonColor="#4f46e5" loading={paying} disabled={paying} onPress={handlePayment}>{isBN ? 'জমা দিন' : 'Submit'}</Button>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Customer Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowAddModal(false)}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>
                    {isBN ? 'নতুন গ্রাহক যুক্ত করুন' : 'Add New Customer'}
                  </Text>
                  <TextInput mode="outlined" label={isBN ? 'নাম *' : 'Name *'} value={newCust.name} onChangeText={(t) => setNewCust({ ...newCust, name: t })} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'মোবাইল নম্বর' : 'Phone'} value={newCust.phone} onChangeText={(t) => setNewCust({ ...newCust, phone: t })} keyboardType="phone-pad" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ইমেইল' : 'Email'} value={newCust.email} onChangeText={(t) => setNewCust({ ...newCust, email: t })} keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ঠিকানা' : 'Address'} value={newCust.address} onChangeText={(t) => setNewCust({ ...newCust, address: t })} multiline numberOfLines={2} style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <Button disabled={addingCustomer} onPress={() => setShowAddModal(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                    <Button mode="contained" buttonColor="#4f46e5" loading={addingCustomer} disabled={addingCustomer} onPress={handleAddCustomer}>{isBN ? 'যুক্ত করুন' : 'Add Customer'}</Button>
                  </View>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
