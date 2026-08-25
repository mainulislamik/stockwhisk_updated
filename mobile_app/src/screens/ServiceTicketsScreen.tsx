import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Modal, Portal, Divider, useTheme, FAB, Menu } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

type Ticket = {
  id: number;
  ticket_no: string;
  customer?: number | null;
  customer_name?: string;
  customer_phone?: string;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  advance_paid?: string;
  discount?: string;
  is_overdue?: boolean;
  received_at: string;
  estimated_delivery?: string;
  technician_notes?: string;
};

const STATUS_CONFIG: Record<string, { labelBn: string; labelEn: string; color: string }> = {
  received: { labelBn: 'গৃহীত', labelEn: 'Received', color: '#64748b' },
  diagnosing: { labelBn: 'পরীক্ষা চলছে', labelEn: 'Diagnosing', color: '#0284c7' },
  awaiting_parts: { labelBn: 'পার্টসের অপেক্ষা', labelEn: 'Awaiting Parts', color: '#d97706' },
  in_repair: { labelBn: 'মেরামত চলছে', labelEn: 'In Repair', color: '#e11d48' },
  ready_for_pickup: { labelBn: 'ডেলিভারির জন্য প্রস্তুত', labelEn: 'Ready for Pickup', color: '#4f46e5' },
  delivered: { labelBn: 'ডেলিভারি সম্পন্ন', labelEn: 'Delivered', color: '#16a34a' },
  cancelled: { labelBn: 'বাতিল', labelEn: 'Cancelled', color: '#475569' },
};

export default function ServiceTicketsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [activeTab, setActiveTab] = useState<'tickets' | 'warranty'>('tickets');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selected Ticket details modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add Ticket Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    customer_name: '',
    customer_phone: '',
    device_description: '',
    complaint: '',
    service_charge: '',
    advance_paid: '',
    estimated_delivery: ''
  });

  // Warranty check state
  const [warrantyBarcode, setWarrantyBarcode] = useState('');
  const [warrantyResult, setWarrantyResult] = useState<any>(null);
  const [checkingWarranty, setCheckingWarranty] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [debouncedSearch, activeTab]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/service/tickets/', {
        params: { search: debouncedSearch, page_size: 50 }
      });
      setTickets(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.device_description.trim() || !newTicket.complaint.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'ডিভাইস ও সমস্যার বিবরণ আবশ্যক।' : 'Device and Complaint are required.');
      return;
    }
    setCreatingTicket(true);
    try {
      await api.post('/service/tickets/', {
        customer_name: newTicket.customer_name.trim(),
        customer_phone: newTicket.customer_phone.trim(),
        device_description: newTicket.device_description.trim(),
        complaint: newTicket.complaint.trim(),
        service_charge: Number(newTicket.service_charge) || 0,
        advance_paid: Number(newTicket.advance_paid) || 0,
        estimated_delivery: newTicket.estimated_delivery || null
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'সার্ভিস টিকিট তৈরি হয়েছে।' : 'Service ticket created successfully!');
      setShowAddModal(false);
      setNewTicket({
        customer_name: '', customer_phone: '', device_description: '',
        complaint: '', service_charge: '', advance_paid: '', estimated_delivery: ''
      });
      fetchTickets();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || (isBN ? 'টিকিট তৈরি ব্যর্থ হয়েছে।' : 'Failed to create ticket.'));
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    setStatusMenuVisible(false);
    try {
      const res = await api.patch(`/service/tickets/${selectedTicket.id}/`, { status: newStatus });
      setSelectedTicket(res.data);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: newStatus } : t));
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'স্ট্যাটাস পরিবর্তন হয়েছে।' : 'Status updated!');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।' : 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCheckWarranty = async () => {
    if (!warrantyBarcode.trim()) return;
    setCheckingWarranty(true);
    setWarrantyResult(null);
    try {
      const res = await api.get('/service/warranties/', {
        params: { search: warrantyBarcode.trim(), include_expired: 'true' }
      });
      const list = res.data.results || res.data || [];
      if (list.length > 0) {
        setWarrantyResult(list[0]);
      } else {
        Alert.alert(isBN ? 'তথ্য নেই' : 'Not Found', isBN ? 'এই বারকোডের কোনো ওয়ারেন্টি তথ্য পাওয়া যায়নি।' : 'No warranty found for this barcode.');
      }
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'ওয়ারেন্টি চেক করতে সমস্যা হয়েছে।' : 'Failed to check warranty.');
    } finally {
      setCheckingWarranty(false);
    }
  };

  const handleSendWhatsApp = (tkt: Ticket) => {
    const phone = tkt.customer_phone || '';
    const digits = phone.replace(/\D/g, '');
    const intl = digits.startsWith('880') ? digits : (digits.startsWith('01') ? `88${digits}` : digits);
    const cfg = STATUS_CONFIG[tkt.status] || { labelBn: tkt.status, labelEn: tkt.status };
    const stLabel = isBN ? cfg.labelBn : cfg.labelEn;

    const msg = isBN
      ? `হ্যালো ${tkt.customer_name || 'গ্রাহক'},\n\nআপনার সার্ভিস টিকিট #${tkt.ticket_no} (${tkt.device_description}) এর বর্তমান স্ট্যাটাস: *${stLabel}*।\nসার্ভিস চার্জ: ৳${tkt.service_charge}।\n\nStockWhisk সার্ভিস সেন্টার।`
      : `Hello ${tkt.customer_name || 'Customer'},\n\nYour service ticket #${tkt.ticket_no} (${tkt.device_description}) status is now: *${stLabel}*.\nService Charge: ৳${tkt.service_charge}.\n\nStockWhisk Service Center.`;

    Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'সার্ভিস ও মেরামত' : 'Service & Repair'} titleStyle={{ fontWeight: 'bold' }} />
        {activeTab === 'tickets' && <Appbar.Action icon="plus" onPress={() => setShowAddModal(true)} />}
      </Appbar.Header>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 8, padding: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeTab === 'tickets' ? '#4f46e5' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('tickets')}
        >
          <Text style={{ color: activeTab === 'tickets' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold' }}>
            {isBN ? 'রিপেয়ার টিকিট' : 'Repair Tickets'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeTab === 'warranty' ? '#4f46e5' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('warranty')}
        >
          <Text style={{ color: activeTab === 'warranty' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold' }}>
            {isBN ? 'ওয়ারেন্টি চেক' : 'Warranty Lookup'}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tickets' ? (
        <>
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TextInput
              mode="outlined"
              placeholder={isBN ? 'টিকিট নং, গ্রাহক বা ডিভাইস খুঁজুন...' : 'Search ticket, customer or device...'}
              value={search}
              onChangeText={setSearch}
              left={<TextInput.Icon icon="magnify" />}
              style={{ backgroundColor: theme.colors.surface }}
            />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
              {tickets.map((tkt) => {
                const cfg = STATUS_CONFIG[tkt.status] || { labelBn: tkt.status, labelEn: tkt.status, color: '#64748b' };
                return (
                  <Card key={tkt.id} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} onPress={() => setSelectedTicket(tkt)}>
                    <Card.Content>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>#{tkt.ticket_no}</Text>
                        <View style={{
                          backgroundColor: cfg.color,
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
                            {isBN ? cfg.labelBn : cfg.labelEn}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontWeight: '600', fontSize: 15, marginTop: 4 }}>{tkt.device_description}</Text>
                      <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginTop: 2 }}>{isBN ? 'সমস্যা:' : 'Issue:'} {tkt.complaint}</Text>
                      
                      <Divider style={{ marginVertical: 8 }} />
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                          {tkt.customer_name || (isBN ? 'সাধারণ গ্রাহক' : 'Customer')} {tkt.customer_phone ? `(${tkt.customer_phone})` : ''}
                        </Text>
                        <Text style={{ fontWeight: 'bold', color: '#4f46e5' }}>৳{Number(tkt.service_charge || 0).toFixed(2)}</Text>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })}
              {tickets.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="tools" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
                  <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    {isBN ? 'কোনো সার্ভিস টিকিট নেই' : 'No service tickets found'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <FAB
            icon="plus"
            color="#fff"
            style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#4f46e5' }}
            onPress={() => setShowAddModal(true)}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Card style={{ padding: 16, backgroundColor: theme.colors.surface, marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
              {isBN ? 'পণ্য বা ইউনিটের বারকোড লিখুন' : 'Enter Item Barcode'}
            </Text>
            <TextInput
              mode="outlined"
              placeholder="e.g. SN-98745612"
              value={warrantyBarcode}
              onChangeText={setWarrantyBarcode}
              left={<TextInput.Icon icon="barcode" />}
              right={<TextInput.Icon icon="barcode-scan" onPress={() => setShowCameraScanner(true)} />}
              style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
            />
            <Button mode="contained" buttonColor="#4f46e5" loading={checkingWarranty} disabled={checkingWarranty || !warrantyBarcode} onPress={handleCheckWarranty}>
              {isBN ? 'ওয়ারেন্টি খুঁজুন' : 'Lookup Warranty'}
            </Button>
          </Card>

          {warrantyResult && (
            <Card style={{ backgroundColor: theme.colors.surface, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{warrantyResult.product_name || 'Item Warranty'}</Text>
                <View style={{
                  backgroundColor: warrantyResult.is_valid !== false ? '#16a34a' : '#dc2626',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: 11,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}>
                    {warrantyResult.is_valid !== false ? (isBN ? 'সক্রিয়' : 'Active') : (isBN ? 'মেয়াদোত্তীর্ণ' : 'Expired')}
                  </Text>
                </View>
              </View>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 4 }}>{isBN ? 'বারকোড:' : 'Barcode:'} {warrantyResult.barcode || warrantyBarcode}</Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 4 }}>{isBN ? 'মেয়াদ:' : 'Warranty:'} {warrantyResult.warranty_months} {isBN ? 'মাস' : 'Months'}</Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 4 }}>{isBN ? 'বিক্রয়ের তারিখ:' : 'Sale Date:'} {warrantyResult.sold_at || 'N/A'}</Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'শেষ তারিখ:' : 'Valid Until:'} {warrantyResult.expires_at || 'N/A'}</Text>
            </Card>
          )}
        </ScrollView>
      )}

      {/* Ticket Details & Action Modal */}
      <Portal>
        <Modal
          visible={!!selectedTicket}
          onDismiss={() => setSelectedTicket(null)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 460 }}
        >
          {selectedTicket && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>#{selectedTicket.ticket_no}</Text>
                <Menu
                  visible={statusMenuVisible}
                  onDismiss={() => setStatusMenuVisible(false)}
                  anchor={
                    <Button mode="outlined" onPress={() => setStatusMenuVisible(true)} compact loading={updatingStatus}>
                      {isBN ? STATUS_CONFIG[selectedTicket.status]?.labelBn || selectedTicket.status : STATUS_CONFIG[selectedTicket.status]?.labelEn || selectedTicket.status} ▼
                    </Button>
                  }
                >
                  {Object.keys(STATUS_CONFIG).map((k) => (
                    <Menu.Item
                      key={k}
                      onPress={() => handleUpdateStatus(k)}
                      title={isBN ? STATUS_CONFIG[k].labelBn : STATUS_CONFIG[k].labelEn}
                    />
                  ))}
                </Menu>
              </View>

              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{selectedTicket.device_description}</Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 8 }}>{isBN ? 'সমস্যা:' : 'Complaint:'} {selectedTicket.complaint}</Text>
              
              <Divider style={{ marginVertical: 8 }} />
              
              <Text style={{ marginBottom: 4 }}>{isBN ? 'গ্রাহক:' : 'Customer:'} {selectedTicket.customer_name || 'N/A'}</Text>
              <Text style={{ marginBottom: 4 }}>{isBN ? 'মোবাইল:' : 'Phone:'} {selectedTicket.customer_phone || 'N/A'}</Text>
              <Text style={{ marginBottom: 4 }}>{isBN ? 'সার্ভিস চার্জ:' : 'Service Charge:'} ৳{Number(selectedTicket.service_charge || 0).toFixed(2)}</Text>
              <Text style={{ marginBottom: 4 }}>{isBN ? 'অগ্রিম গ্রহণ:' : 'Advance Paid:'} ৳{Number(selectedTicket.advance_paid || 0).toFixed(2)}</Text>
              
              <View style={{ marginTop: 20, gap: 8 }}>
                {selectedTicket.customer_phone && selectedTicket.customer_phone.replace(/\D/g, '').length >= 10 && (
                  <Button mode="contained" buttonColor="#25D366" textColor="#fff" icon="whatsapp" onPress={() => handleSendWhatsApp(selectedTicket)}>
                    {isBN ? 'হোয়াটসঅ্যাপে আপডেট পাঠান' : 'Send WhatsApp Update'}
                  </Button>
                )}
                <Button mode="outlined" onPress={() => setSelectedTicket(null)}>
                  {isBN ? 'বন্ধ করুন' : 'Close'}
                </Button>
              </View>
            </View>
          )}
        </Modal>

        {/* Add Ticket Modal */}
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, padding: 20, borderRadius: 12, alignSelf: 'center', width: '100%', maxWidth: 460 }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>
              {isBN ? 'নতুন রিপেয়ার টিকিট তৈরি করুন' : 'Create Repair Ticket'}
            </Text>

            <TextInput
              mode="outlined"
              label={isBN ? 'গ্রাহকের নাম' : 'Customer Name'}
              value={newTicket.customer_name}
              onChangeText={(t) => setNewTicket({ ...newTicket, customer_name: t })}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'মোবাইল নম্বর' : 'Customer Phone'}
              value={newTicket.customer_phone}
              onChangeText={(t) => setNewTicket({ ...newTicket, customer_phone: t })}
              keyboardType="phone-pad"
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'ডিভাইসের বিবরণ (যেমন: Samsung A52) *' : 'Device Description *'}
              value={newTicket.device_description}
              onChangeText={(t) => setNewTicket({ ...newTicket, device_description: t })}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'সমস্যার বিবরণ *' : 'Complaint / Issue *'}
              value={newTicket.complaint}
              onChangeText={(t) => setNewTicket({ ...newTicket, complaint: t })}
              multiline
              numberOfLines={2}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'সম্ভাব্য সার্ভিস চার্জ (৳)' : 'Estimated Service Charge (৳)'}
              value={newTicket.service_charge}
              onChangeText={(t) => setNewTicket({ ...newTicket, service_charge: t })}
              keyboardType="numeric"
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'অগ্রিম জমা (৳)' : 'Advance Paid (৳)'}
              value={newTicket.advance_paid}
              onChangeText={(t) => setNewTicket({ ...newTicket, advance_paid: t })}
              keyboardType="numeric"
              style={{ marginBottom: 20, backgroundColor: theme.colors.surface }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button disabled={creatingTicket} onPress={() => setShowAddModal(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
              <Button mode="contained" buttonColor="#4f46e5" loading={creatingTicket} disabled={creatingTicket} onPress={handleCreateTicket}>
                {isBN ? 'টিকিট তৈরি করুন' : 'Create Ticket'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <CameraBarcodeScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanned={(code) => setWarrantyBarcode(code)}
      />
    </View>
  );
}
