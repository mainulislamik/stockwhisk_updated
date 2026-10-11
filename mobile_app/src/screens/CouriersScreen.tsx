import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator, Share } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Modal, Portal, Divider, useTheme, FAB, SegmentedButtons, Switch } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

export type CourierAccount = {
  id: number;
  name: string;
  provider: 'steadfast' | 'pathao' | 'redx' | 'custom' | string;
  merchant_id?: string;
  is_active: boolean;
  is_default: boolean;
};

export type CourierShipment = {
  id: number;
  consignment_id?: string;
  tracking_id?: string;
  courier_name?: string;
  provider?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: string;
  weight_kg: string;
  status: string;
  status_display?: string;
  tracking_url?: string;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { labelBn: string; labelEn: string; color: string; bg: string }> = {
  pending: { labelBn: 'অপেক্ষমাণ', labelEn: 'Pending', color: '#d97706', bg: '#fef3c7' },
  in_transit: { labelBn: 'চলমান (On the Way)', labelEn: 'In Transit', color: '#0284c7', bg: '#e0f2fe' },
  delivered: { labelBn: 'ডেলিভার্ড', labelEn: 'Delivered', color: '#16a34a', bg: '#dcfce7' },
  cancelled: { labelBn: 'বাতিল', labelEn: 'Cancelled', color: '#ef4444', bg: '#fee2e2' },
  returned: { labelBn: 'ফেরত', labelEn: 'Returned', color: '#64748b', bg: '#f1f5f9' },
};

export default function CouriersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [activeTab, setActiveTab] = useState<'shipments' | 'accounts'>('shipments');
  const [shipments, setShipments] = useState<CourierShipment[]>([]);
  const [accounts, setAccounts] = useState<CourierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Book shipment modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [bookForm, setBookForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    recipient_address: '',
    cod_amount: '',
    weight_kg: '0.5',
    item_description: 'Parcel',
  });

  // Add courier account modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: 'Steadfast Courier',
    provider: 'steadfast',
    api_key: '',
    api_secret: '',
    merchant_id: '',
    is_active: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchAccounts();
    fetchShipments();
  }, [debouncedSearch, statusFilter]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/integrations/couriers/');
      const list = res.data.results || res.data || [];
      setAccounts(list);
      if (list.length > 0 && !selectedAccountId) {
        setSelectedAccountId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 50 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/integrations/shipments/', { params });
      setShipments(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBookShipment = async () => {
    if (!selectedAccountId) {
      Alert.alert(isBN ? 'ভুল' : 'Error', isBN ? 'অনুগ্রহ করে একটি কুরিয়ার অ্যাকাউন্ট সিলেক্ট করুন।' : 'Select a courier account.');
      return;
    }
    if (!bookForm.recipient_name.trim() || !bookForm.recipient_phone.trim() || !bookForm.recipient_address.trim()) {
      Alert.alert(isBN ? 'ভুল' : 'Error', isBN ? 'প্রাপকের নাম, ফোন ও ঠিকানা আবশ্যক।' : 'Recipient name, phone, and address are required.');
      return;
    }

    setBookingLoading(true);
    try {
      await api.post('/integrations/shipments/book/', {
        account_id: selectedAccountId,
        recipient_name: bookForm.recipient_name.trim(),
        recipient_phone: bookForm.recipient_phone.trim(),
        recipient_address: bookForm.recipient_address.trim(),
        cod_amount: parseFloat(bookForm.cod_amount) || 0,
        weight_kg: parseFloat(bookForm.weight_kg) || 0.5,
        item_description: bookForm.item_description.trim() || 'Parcel',
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পার্সেল সফলভাবে কুরিয়ারে বুকিং দেওয়া হয়েছে!' : 'Parcel booked successfully!');
      setShowBookModal(false);
      setBookForm({
        recipient_name: '',
        recipient_phone: '',
        recipient_address: '',
        cod_amount: '',
        weight_kg: '0.5',
        item_description: 'Parcel',
      });
      fetchShipments();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || (isBN ? 'পার্সেল বুকিং ব্যর্থ হয়েছে' : 'Booking failed');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', String(msg));
    } finally {
      setBookingLoading(false);
    }
  };

  const handleTrackShipment = async (s: CourierShipment) => {
    try {
      const res = await api.post(`/integrations/shipments/${s.id}/track/`);
      Alert.alert(
        isBN ? 'লাইভ ট্র্যাকিং তথ্য' : 'Tracking Info',
        isBN ? `স্ট্যাটাস: ${res.data?.status || 'সফল'} 
ট্র্যাকিং আইডি: ${res.data?.tracking_id || s.tracking_id || 'N/A'}` : `Status: ${res.data?.status} 
Tracking ID: ${res.data?.tracking_id || 'N/A'}`
      );
      fetchShipments();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'ট্র্যাকিং তথ্য পাওয়া যায়নি' : 'Failed to fetch tracking');
    }
  };

  const handleCancelShipment = async (s: CourierShipment) => {
    Alert.alert(
      isBN ? 'পার্সেল বাতিল' : 'Cancel Shipment',
      isBN ? 'আপনি কি নিশ্চিতভাবে এই পার্সেলটি বাতিল করতে চান?' : 'Are you sure you want to cancel this shipment?',
      [
        { text: isBN ? 'না' : 'No', style: 'cancel' },
        {
          text: isBN ? 'হ্যাঁ, বাতিল' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/integrations/shipments/${s.id}/cancel/`, { reason: 'Merchant cancelled' });
              Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পার্সেল বাতিল করা হয়েছে।' : 'Shipment cancelled.');
              fetchShipments();
            } catch (e: any) {
              Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'বাতিল করা সম্ভব হয়নি।' : 'Cancellation failed.');
            }
          },
        },
      ]
    );
  };

  const handleSaveAccount = async () => {
    if (!accountForm.name.trim() || !accountForm.api_key.trim()) {
      Alert.alert(isBN ? 'ভুল' : 'Error', isBN ? 'অ্যাকাউন্টের নাম ও এপিআই কি আবশ্যক।' : 'Name and API Key are required.');
      return;
    }
    setSavingAccount(true);
    try {
      await api.post('/integrations/couriers/', {
        name: accountForm.name.trim(),
        provider: accountForm.provider,
        api_key: accountForm.api_key.trim(),
        api_secret: accountForm.api_secret.trim(),
        merchant_id: accountForm.merchant_id.trim(),
        is_active: accountForm.is_active,
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'কুরিয়ার অ্যাকাউন্ট সংযুক্ত হয়েছে!' : 'Courier account saved!');
      setShowAccountModal(false);
      fetchAccounts();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || (isBN ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save account');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', String(msg));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleValidateAccount = async (acc: CourierAccount) => {
    try {
      await api.post(`/integrations/couriers/${acc.id}/validate_credentials/`);
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'কুরিয়ার এপিআই সংযোগ সফল এবং সচল!' : 'Courier API credentials verified!');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'এপিআই সংযোগ ব্যর্থ হয়েছে। কি বা সিক্রেট চেক করুন।' : 'Credential validation failed.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'কুরিয়ার ও পার্সেল শিপমেন্ট' : 'Couriers & Shipments'} />
        <Appbar.Action icon="refresh" onPress={() => { fetchAccounts(); fetchShipments(); }} />
        <PageGuideButton pageKey="/app/integrations/couriers" />
      </Appbar.Header>

      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          buttons={[
            { value: 'shipments', label: isBN ? '📦 পার্সেলসমূহ' : '📦 Shipments' },
            { value: 'accounts', label: isBN ? '⚙️ কুরিয়ার অ্যাকাউন্ট' : '⚙️ Accounts' },
          ]}
          style={{ marginBottom: 10 }}
        />

        {activeTab === 'shipments' && (
          <>
            <TextInput
              mode="outlined"
              placeholder={isBN ? 'ট্র্যাকিং আইডি, নাম বা ফোন দিয়ে খুঁজুন...' : 'Search by tracking, name, phone...'}
              value={search}
              onChangeText={setSearch}
              left={<TextInput.Icon icon="magnify" />}
              right={search ? <TextInput.Icon icon="close" onPress={() => setSearch('')} /> : undefined}
              style={{ height: 42, backgroundColor: theme.colors.surface, marginBottom: 6 }}
              dense
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {['all', 'pending', 'in_transit', 'delivered', 'cancelled'].map((st) => (
                <Chip
                  key={st}
                  selected={statusFilter === st}
                  onPress={() => setStatusFilter(st)}
                  style={{ backgroundColor: statusFilter === st ? '#6366f1' : theme.colors.surface }}
                  textStyle={{ color: statusFilter === st ? '#ffffff' : theme.colors.onSurface, fontWeight: '700', fontSize: 11 }}
                >
                  {st === 'all' ? (isBN ? 'সব' : 'All') : isBN ? STATUS_CONFIG[st]?.labelBn : STATUS_CONFIG[st]?.labelEn}
                </Chip>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {activeTab === 'shipments' ? (
        loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
            {shipments.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <MaterialCommunityIcons name="truck-fast-outline" size={54} color="#94a3b8" />
                <Text style={{ marginTop: 12, color: '#64748b', fontWeight: '700' }}>
                  {isBN ? 'কোনো কুরিয়ার পার্সেল পাওয়া যায়নি।' : 'No courier shipments found.'}
                </Text>
              </View>
            ) : (
              shipments.map((s) => {
                const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                return (
                  <Card
                    key={s.id}
                    style={{
                      marginBottom: 12,
                      backgroundColor: theme.colors.surface,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    }}
                  >
                    <Card.Content>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="truck-delivery" size={18} color="#4338ca" style={{ marginRight: 6 }} />
                          <Text style={{ fontWeight: '800', fontSize: 14, color: theme.colors.onSurface }}>
                            {s.tracking_id || s.consignment_id || `PARCEL-#${s.id}`}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                          <Text style={{ color: st.color, fontWeight: '800', fontSize: 11 }}>
                            {isBN ? st.labelBn : st.labelEn}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.onSurface }}>
                          {s.recipient_name}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>
                          COD: ৳{s.cod_amount}
                        </Text>
                      </View>

                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                        📞 {s.recipient_phone}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }} numberOfLines={2}>
                        📍 {s.recipient_address}
                      </Text>

                      <Divider style={{ marginVertical: 6 }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                        <TouchableOpacity
                          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => handleTrackShipment(s)}
                        >
                          <MaterialCommunityIcons name="radar" size={16} color="#2563eb" style={{ marginRight: 4 }} />
                          <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 12 }}>{isBN ? 'ট্র্যাকিং' : 'Track'}</Text>
                        </TouchableOpacity>
                        {s.status === 'pending' && (
                          <TouchableOpacity
                            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => handleCancelShipment(s)}
                          >
                            <MaterialCommunityIcons name="close" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>{isBN ? 'বাতিল' : 'Cancel'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.onSurface }}>
              {isBN ? 'কানেক্টেড কুরিয়ার প্রোভাইডার' : 'Connected Couriers'}
            </Text>
            <Button mode="contained" compact onPress={() => setShowAccountModal(true)} buttonColor="#6366f1">
              + {isBN ? 'অ্যাকাউন্ট যুক্ত করুন' : 'Add Account'}
            </Button>
          </View>

          {accounts.length === 0 ? (
            <Card style={{ padding: 16, alignItems: 'center', backgroundColor: theme.colors.surface }}>
              <MaterialCommunityIcons name="transit-connection-variant" size={48} color="#94a3b8" />
              <Text style={{ marginTop: 10, color: '#64748b', fontWeight: '700', textAlign: 'center' }}>
                {isBN ? 'কোনো কুরিয়ার অ্যাকাউন্ট এখনো যুক্ত করা হয়নি। Steadfast বা Pathao যুক্ত করে দ্রুত পার্সেল পাঠান।' : 'No courier accounts connected yet.'}
              </Text>
            </Card>
          ) : (
            accounts.map((acc) => (
              <Card
                key={acc.id}
                style={{
                  marginBottom: 10,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                }}
              >
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.onSurface }}>
                        {acc.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: '700', textTransform: 'uppercase' }}>
                        {acc.provider} {acc.merchant_id ? `(ID: ${acc.merchant_id})` : ''}
                      </Text>
                    </View>
                    <Chip style={{ backgroundColor: acc.is_active ? '#dcfce7' : '#fee2e2' }}>
                      <Text style={{ color: acc.is_active ? '#16a34a' : '#ef4444', fontWeight: '800', fontSize: 11 }}>
                        {acc.is_active ? (isBN ? 'সক্রিয়' : 'Active') : (isBN ? 'নিষ্ক্রিয়' : 'Inactive')}
                      </Text>
                    </Chip>
                  </View>

                  <Divider style={{ marginVertical: 10 }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleValidateAccount(acc)}
                    >
                      {isBN ? 'টেস্ট কানেকশন' : 'Test API'}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Book Shipment FAB */}
      {activeTab === 'shipments' && (
        <FAB
          icon="plus"
          label={isBN ? 'নতুন বুকিং' : 'Book Parcel'}
          style={{
            position: 'absolute',
            margin: 16,
            right: 0,
            bottom: 10,
            backgroundColor: '#6366f1',
          }}
          color="#ffffff"
          onPress={() => setShowBookModal(true)}
        />
      )}

      {/* Book Shipment Modal */}
      <Portal>
        <Modal
          visible={showBookModal}
          onDismiss={() => setShowBookModal(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 16,
            padding: 16,
            borderRadius: 16,
            maxHeight: '90%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 17, fontWeight: '800', marginBottom: 12, color: theme.colors.onSurface }}>
              🚚 {isBN ? 'কুরিয়ার পার্সেল বুকিং' : 'Book Courier Parcel'}
            </Text>

            {accounts.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>
                  {isBN ? 'কুরিয়ার অ্যাকাউন্ট নির্বাচন:' : 'Select Courier Account:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {accounts.map((a) => (
                    <Chip
                      key={a.id}
                      selected={selectedAccountId === a.id}
                      onPress={() => setSelectedAccountId(a.id)}
                      style={{ backgroundColor: selectedAccountId === a.id ? '#4f46e5' : '#f1f5f9' }}
                      textStyle={{ color: selectedAccountId === a.id ? '#ffffff' : '#1e293b', fontWeight: '700', fontSize: 11 }}
                    >
                      {a.name} ({a.provider})
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput
              mode="outlined"
              label={isBN ? 'প্রাপকের নাম *' : 'Recipient Name *'}
              value={bookForm.recipient_name}
              onChangeText={(t) => setBookForm(prev => ({ ...prev, recipient_name: t }))}
              style={{ marginBottom: 8 }}
              dense
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'প্রাপকের ফোন *' : 'Recipient Phone *'}
              value={bookForm.recipient_phone}
              onChangeText={(t) => setBookForm(prev => ({ ...prev, recipient_phone: t }))}
              keyboardType="phone-pad"
              style={{ marginBottom: 8 }}
              dense
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'পূর্ণ ঠিকানা *' : 'Full Address *'}
              value={bookForm.recipient_address}
              onChangeText={(t) => setBookForm(prev => ({ ...prev, recipient_address: t }))}
              multiline
              numberOfLines={2}
              style={{ marginBottom: 8 }}
              dense
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput
                mode="outlined"
                label={isBN ? 'COD পরিমাণ (৳)' : 'COD Amount (৳)'}
                value={bookForm.cod_amount}
                onChangeText={(t) => setBookForm(prev => ({ ...prev, cod_amount: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
              <TextInput
                mode="outlined"
                label={isBN ? 'ওজন (kg)' : 'Weight (kg)'}
                value={bookForm.weight_kg}
                onChangeText={(t) => setBookForm(prev => ({ ...prev, weight_kg: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button mode="text" onPress={() => setShowBookModal(false)}>
                {isBN ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button mode="contained" onPress={handleBookShipment} loading={bookingLoading} buttonColor="#6366f1">
                {isBN ? 'বুকিং নিশ্চিত করুন' : 'Confirm Booking'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Add Account Modal */}
      <Portal>
        <Modal
          visible={showAccountModal}
          onDismiss={() => setShowAccountModal(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 16,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '800', marginBottom: 12, color: theme.colors.onSurface }}>
            ⚙️ {isBN ? 'নতুন কুরিয়ার অ্যাকাউন্ট সংযোগ' : 'Add Courier Account'}
          </Text>

          <TextInput
            mode="outlined"
            label={isBN ? 'অ্যাকাউন্টের নাম' : 'Account Name'}
            value={accountForm.name}
            onChangeText={(t) => setAccountForm(prev => ({ ...prev, name: t }))}
            style={{ marginBottom: 8 }}
            dense
          />

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>
              {isBN ? 'প্রোভাইডার নির্বাচন করুন:' : 'Select Provider:'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['steadfast', 'pathao', 'redx'].map((p) => (
                <Chip
                  key={p}
                  selected={accountForm.provider === p}
                  onPress={() => setAccountForm(prev => ({ ...prev, provider: p, name: `${p.toUpperCase()} Courier` }))}
                  style={{ backgroundColor: accountForm.provider === p ? '#4f46e5' : '#f1f5f9' }}
                  textStyle={{ color: accountForm.provider === p ? '#ffffff' : '#1e293b', fontWeight: '700', textTransform: 'capitalize' }}
                >
                  {p}
                </Chip>
              ))}
            </View>
          </View>

          <TextInput
            mode="outlined"
            label="API Key / App Key *"
            value={accountForm.api_key}
            onChangeText={(t) => setAccountForm(prev => ({ ...prev, api_key: t }))}
            style={{ marginBottom: 8 }}
            dense
          />
          <TextInput
            mode="outlined"
            label="API Secret / Secret Key"
            value={accountForm.api_secret}
            onChangeText={(t) => setAccountForm(prev => ({ ...prev, api_secret: t }))}
            secureTextEntry
            style={{ marginBottom: 8 }}
            dense
          />
          <TextInput
            mode="outlined"
            label="Merchant ID / Store ID (Optional)"
            value={accountForm.merchant_id}
            onChangeText={(t) => setAccountForm(prev => ({ ...prev, merchant_id: t }))}
            style={{ marginBottom: 12 }}
            dense
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button mode="text" onPress={() => setShowAccountModal(false)}>
              {isBN ? 'বাতিল' : 'Cancel'}
            </Button>
            <Button mode="contained" onPress={handleSaveAccount} loading={savingAccount} buttonColor="#6366f1">
              {isBN ? 'সংরক্ষণ' : 'Save'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
