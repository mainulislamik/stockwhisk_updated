import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Linking, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Appbar, TextInput, Card, Text, Button, ActivityIndicator, Divider, useTheme, FAB } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  due_balance: string;
  due_date?: string | null;
}

export default function SuppliersScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);

  // Add supplier
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSup, setNewSup] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchasing/suppliers/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setSuppliers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedSupplier || !amount) return;
    const payNum = Number(amount);
    const dueNum = Number(selectedSupplier.due_balance) || 0;
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
      await api.post(`/purchasing/suppliers/${selectedSupplier.id}/pay-due/`, {
        amount: Number(amount),
        method,
        note
      }).catch(async () => {
        return api.post(`/purchasing/suppliers/${selectedSupplier.id}/payments/`, {
          amount,
          method,
          note
        });
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'সরবরাহকারীকে পেমেন্ট প্রদান সম্পন্ন হয়েছে।' : 'Payment recorded successfully');
      setPaymentModalVisible(false);
      setSelectedSupplier(null);
      setAmount('');
      setNote('');
      fetchSuppliers();
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.response?.data?.error || e.message || (isBN ? 'পেমেন্ট প্রসেস করতে ব্যর্থ হয়েছে।' : 'Failed to process payment');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', errMsg);
    } finally {
      setPaying(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSup.name.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'সরবরাহকারীর নাম আবশ্যক।' : 'Supplier name is required.');
      return;
    }
    setAddingSupplier(true);
    try {
      await api.post('/purchasing/suppliers/', newSup);
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন সরবরাহকারী যুক্ত হয়েছে।' : 'Supplier added successfully!');
      setShowAddModal(false);
      setNewSup({ name: '', phone: '', email: '', address: '' });
      fetchSuppliers();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || (isBN ? 'সরবরাহকারী যুক্ত করতে ব্যর্থ হয়েছে।' : 'Failed to add supplier.'));
    } finally {
      setAddingSupplier(false);
    }
  };

  const PAYMENT_METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
    { key: 'bank_transfer', label: isBN ? 'ব্যাংক' : 'Bank' },
  ];

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.includes(search))
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'সরবরাহকারী' : 'Suppliers'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/suppliers" />
        <Appbar.Action icon="plus" onPress={() => setShowAddModal(true)} />
      </Appbar.Header>
      
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'সরবরাহকারীর নাম বা মোবাইল খুঁজুন...' : 'Search suppliers...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {loading && <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} />}
        {filteredSuppliers.map((s) => (
          <Card key={s.id} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} onPress={() => setSelectedSupplier(s)}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{s.name}</Text>
                  <Text variant="bodyMedium" style={{ color: isDarkMode ? '#94a3b8' : theme.colors.onSurfaceVariant, marginTop: 2 }}>{s.phone || (isBN ? 'ফোন নম্বর নেই' : 'No phone')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {Number(s.due_balance || 0) > 0 ? (
                    <>
                      <Text variant="bodySmall" style={{ color: '#dc2626' }}>{isBN ? 'বকেয়া দিতে হবে:' : 'Due to pay:'}</Text>
                      <Text variant="titleMedium" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                        ৳{s.due_balance}
                      </Text>
                      {!!s.due_date && (
                        <Text variant="bodySmall" style={{ color: '#d97706', fontSize: 11, marginTop: 2 }}>
                          📅 {s.due_date}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text variant="bodyMedium" style={{ color: '#16a34a', fontWeight: '500' }}>{isBN ? 'কোনো বকেয়া নেই' : 'No Due'}</Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
        {!loading && filteredSuppliers.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {isBN ? 'কোনো সরবরাহকারী পাওয়া যায়নি' : 'No suppliers found'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB for Adding Supplier */}
      <FAB
        icon="plus"
        color="#fff"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#4f46e5' }}
        onPress={() => setShowAddModal(true)}
      />

      {/* Supplier Detail & Pay Modal */}
      <Modal visible={!!selectedSupplier} transparent animationType="fade" onRequestClose={() => { if (!paymentModalVisible) setSelectedSupplier(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => { if (!paymentModalVisible) setSelectedSupplier(null); }}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!paymentModalVisible && selectedSupplier && (
                    <View>
                      <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 12 }}>{selectedSupplier.name}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ফোন:' : 'Phone:'} {selectedSupplier.phone || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ইমেইল:' : 'Email:'} {selectedSupplier.email || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ঠিকানা:' : 'Address:'} {selectedSupplier.address || 'N/A'}</Text>
                      <Divider style={{ marginVertical: 12 }} />
                      <Text variant="bodyLarge" style={{ color: Number(selectedSupplier.due_balance) > 0 ? '#dc2626' : undefined, fontWeight: 'bold' }}>
                        {isBN ? 'বকেয়া দায়:' : 'Due Balance:'} ৳{selectedSupplier.due_balance || '0'}
                      </Text>
                      {!!selectedSupplier.phone && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                          <Button mode="contained-tonal" icon="phone" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${selectedSupplier.phone}`)}>
                            {isBN ? 'কল করুন' : 'Call'}
                          </Button>
                          <Button mode="contained" icon="whatsapp" buttonColor="#25D366" textColor="#fff" style={{ flex: 1 }} onPress={() => {
                              const digits = selectedSupplier.phone.replace(/\D/g, "");
                              const intl = digits.startsWith("880") ? digits : (digits.startsWith("01") ? `88${digits}` : digits);
                              Linking.openURL(`https://wa.me/${intl}`);
                            }}>
                            WhatsApp
                          </Button>
                        </View>
                      )}
                      <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button mode="outlined" onPress={() => setSelectedSupplier(null)}>{isBN ? 'বন্ধ করুন' : 'Close'}</Button>
                        {Number(selectedSupplier.due_balance) > 0 && (
                          <Button mode="contained" buttonColor="#4f46e5" onPress={() => {
                            setAmount(selectedSupplier.due_balance);
                            setPaymentModalVisible(true);
                          }}>
                            {isBN ? 'পেমেন্ট প্রদান করুন' : 'Pay Supplier'}
                          </Button>
                        )}
                      </View>
                    </View>
                  )}

                  {paymentModalVisible && selectedSupplier && (
                    <View>
                      <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>{isBN ? 'সরবরাহকারীকে পেমেন্ট প্রদান' : 'Pay Supplier'}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                        <TextInput mode="outlined" dense label={isBN ? 'টাকার পরিমাণ' : 'Amount'} value={amount} onChangeText={setAmount} keyboardType="numeric" style={{ flex: 1, backgroundColor: theme.colors.surface }} />
                        <Button mode="outlined" compact onPress={() => setAmount(selectedSupplier.due_balance || '0')} style={{ justifyContent: 'center', borderColor: '#4f46e5' }} textColor="#4f46e5">
                          {isBN ? 'পুরো বকেয়া' : 'Pay Full'}
                        </Button>
                      </View>
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

      {/* Add Supplier Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowAddModal(false)}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>
                    {isBN ? 'নতুন সরবরাহকারী যুক্ত করুন' : 'Add New Supplier'}
                  </Text>
                  <TextInput mode="outlined" label={isBN ? 'নাম *' : 'Name *'} value={newSup.name} onChangeText={(t) => setNewSup({ ...newSup, name: t })} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'মোবাইল নম্বর' : 'Phone'} value={newSup.phone} onChangeText={(t) => setNewSup({ ...newSup, phone: t })} keyboardType="phone-pad" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ইমেইল' : 'Email'} value={newSup.email} onChangeText={(t) => setNewSup({ ...newSup, email: t })} keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ঠিকানা' : 'Address'} value={newSup.address} onChangeText={(t) => setNewSup({ ...newSup, address: t })} multiline numberOfLines={2} style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <Button disabled={addingSupplier} onPress={() => setShowAddModal(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                    <Button mode="contained" buttonColor="#4f46e5" loading={addingSupplier} disabled={addingSupplier} onPress={handleAddSupplier}>{isBN ? 'যুক্ত করুন' : 'Add Supplier'}</Button>
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
