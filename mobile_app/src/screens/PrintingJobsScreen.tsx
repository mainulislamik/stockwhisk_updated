import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator, Share, Platform } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Modal, Portal, Divider, useTheme, FAB, Menu, SegmentedButtons } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch (e) {}
}

export type ServiceJob = {
  id: number;
  job_number: string;
  customer?: number | null;
  customer_name: string;
  customer_phone: string;
  service_type: string;
  reference_no?: string;
  delivery_date?: string;
  status: string;
  status_display?: string;
  govt_fee: string;
  service_charge: string;
  finishing_charge: string;
  other_charge: string;
  discount: string;
  total_bill: string;
  advance_paid: string;
  due_amount?: string;
  track_token?: string;
  specifications?: any;
  created_at?: string;
};

const STATUS_CONFIG: Record<string, { labelBn: string; labelEn: string; color: string; bg: string }> = {
  pending: { labelBn: 'অপেক্ষমাণ', labelEn: 'Pending', color: '#d97706', bg: '#fef3c7' },
  processing: { labelBn: 'কাজ চলছে', labelEn: 'Processing', color: '#0284c7', bg: '#e0f2fe' },
  ready: { labelBn: 'প্রস্তুত', labelEn: 'Ready', color: '#7c3aed', bg: '#ede9fe' },
  delivered: { labelBn: 'ডেলিভারি সম্পন্ন', labelEn: 'Delivered', color: '#16a34a', bg: '#dcfce7' },
  cancelled: { labelBn: 'বাতিল', labelEn: 'Cancelled', color: '#ef4444', bg: '#fee2e2' },
};

export default function PrintingJobsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & details
  const [selectedJob, setSelectedJob] = useState<ServiceJob | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Add job modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);

  // Preset selector
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [bannerWidth, setBannerWidth] = useState('8');
  const [bannerHeight, setBannerHeight] = useState('3');
  const [bannerRate, setBannerRate] = useState('25');
  const [eyeletsCount, setEyeletsCount] = useState('4');

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    service_type: 'ডিজিটাল সেবা ও প্রিন্টিং',
    reference_no: '',
    govt_fee: '0',
    service_charge: '0',
    finishing_charge: '0',
    other_charge: '0',
    discount: '0',
    advance_paid: '0',
    payment_method: 'cash',
    delivery_date: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchJobs();
  }, [debouncedSearch, statusFilter]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 50 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/service/jobs/', { params });
      setJobs(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (key: string) => {
    setSelectedPreset(key);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (key === 'passport_5y') {
      setForm(prev => ({
        ...prev,
        service_type: 'ই-পাসপোর্ট আবেদন (৫ বছর / ৪৮ পাতা)',
        govt_fee: '4025',
        service_charge: '500',
        finishing_charge: '0',
        delivery_date: tomorrow,
      }));
    } else if (key === 'passport_10y') {
      setForm(prev => ({
        ...prev,
        service_type: 'ই-পাসপোর্ট আবেদন (১০ বছর / ৪৮ পাতা)',
        govt_fee: '5750',
        service_charge: '500',
        finishing_charge: '0',
        delivery_date: tomorrow,
      }));
    } else if (key === 'police_clearance') {
      setForm(prev => ({
        ...prev,
        service_type: 'পুলিশ ক্লিয়ারেন্স সার্টিফিকেট',
        govt_fee: '500',
        service_charge: '250',
        finishing_charge: '0',
        delivery_date: tomorrow,
      }));
    } else if (key === 'nid') {
      setForm(prev => ({
        ...prev,
        service_type: 'ভোটার এনআইডি সংশোধন / রি-ইস্যু',
        govt_fee: '230',
        service_charge: '200',
        finishing_charge: '0',
        delivery_date: tomorrow,
      }));
    } else if (key === 'banner') {
      const w = parseFloat(bannerWidth) || 0;
      const h = parseFloat(bannerHeight) || 0;
      const r = parseFloat(bannerRate) || 0;
      const eyelets = parseInt(eyeletsCount, 10) || 0;
      const totalSqft = w * h;
      const printCost = totalSqft * r;
      const finishCost = eyelets * 10;
      setForm(prev => ({
        ...prev,
        service_type: `পিভিসি ব্যানার (${w}x${h} ft)`,
        govt_fee: '0',
        service_charge: String(Math.round(printCost)),
        finishing_charge: String(finishCost),
        delivery_date: tomorrow,
      }));
    } else {
      setForm(prev => ({
        ...prev,
        service_type: 'কাস্টম প্রিন্টিং / সেবা',
        govt_fee: '0',
        service_charge: '0',
        finishing_charge: '0',
        delivery_date: tomorrow,
      }));
    }
  };

  const handleCreateJob = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      Alert.alert(isBN ? 'ভুল' : 'Error', isBN ? 'গ্রাহকের নাম ও ফোন নম্বর বাধ্যতামূলক।' : 'Customer name and phone are required.');
      return;
    }
    setCreatingJob(true);
    try {
      const payload: any = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        service_type: form.service_type.trim(),
        reference_no: form.reference_no.trim(),
        govt_fee: parseFloat(form.govt_fee) || 0,
        service_charge: parseFloat(form.service_charge) || 0,
        finishing_charge: parseFloat(form.finishing_charge) || 0,
        other_charge: parseFloat(form.other_charge) || 0,
        discount: parseFloat(form.discount) || 0,
        advance_paid: parseFloat(form.advance_paid) || 0,
        payment_method: form.payment_method || 'cash',
      };
      if (form.delivery_date) {
        payload.delivery_date = new Date(form.delivery_date).toISOString();
      }
      await api.post('/service/jobs/', payload);
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'জব শিট সফলভাবে তৈরি হয়েছে!' : 'Job sheet created successfully!');
      setShowAddModal(false);
      setForm({
        customer_name: '',
        customer_phone: '',
        service_type: 'ডিজিটাল সেবা ও প্রিন্টিং',
        reference_no: '',
        govt_fee: '0',
        service_charge: '0',
        finishing_charge: '0',
        other_charge: '0',
        discount: '0',
        advance_paid: '0',
        payment_method: 'cash',
        delivery_date: '',
      });
      fetchJobs();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || (isBN ? 'জব শিট তৈরি করা যায়নি' : 'Failed to create job');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', String(msg));
    } finally {
      setCreatingJob(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedJob) return;
    setUpdatingStatus(true);
    try {
      await api.post(`/service/jobs/${selectedJob.id}/update_status/`, { status: newStatus });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'স্ট্যাটাস আপডেট হয়েছে।' : 'Status updated.');
      setShowStatusModal(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'স্ট্যাটাস পরিবর্তন করা সম্ভব হয়নি' : 'Could not change status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedJob || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert(isBN ? 'ভুল' : 'Error', isBN ? 'সঠিক পরিশোধের পরিমাণ লিখুন।' : 'Enter valid payment amount.');
      return;
    }
    setSubmittingPayment(true);
    try {
      await api.post(`/service/jobs/${selectedJob.id}/add_payment/`, {
        amount: parseFloat(paymentAmount),
        payment_method: 'cash',
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'বকেয়া পরিশোধ সফলভাবে সংরক্ষিত হয়েছে!' : 'Payment recorded successfully!');
      setShowPaymentModal(false);
      setSelectedJob(null);
      setPaymentAmount('');
      fetchJobs();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'পেমেন্ট গ্রহণ ব্যর্থ হয়েছে।' : 'Payment failed.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const shareTrackingLink = async (job: ServiceJob) => {
    if (!job.track_token) {
      Alert.alert(isBN ? 'তথ্য নেই' : 'Info', isBN ? 'এই জবের কোনো ট্র্যাকিং টোকেন নেই।' : 'No tracking token available.');
      return;
    }
    const url = `https://stockwhisk.com/track-job/${job.track_token}`;
    const message = isBN
      ? `প্রিয় ${job.customer_name}, আপনার জব শিট (${job.job_number}) লাইভ ট্র্যাক করতে ভিজিট করুন: ${url}`
      : `Dear ${job.customer_name}, track your service job (${job.job_number}) live here: ${url}`;
    try {
      await Share.share({ message });
    } catch (e) {}
  };

  const sendWhatsAppNotice = (job: ServiceJob) => {
    const rawPhone = (job.customer_phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('880') ? rawPhone : rawPhone.startsWith('0') ? '88' + rawPhone : '880' + rawPhone;
    const url = `https://stockwhisk.com/track-job/${job.track_token || ''}`;
    const text = isBN
      ? `হ্যালো ${job.customer_name},
আপনার সেবা: ${job.service_type}
জব নং: ${job.job_number}
মোট বিল: ৳${job.total_bill}
পরিশোধ: ৳${job.advance_paid}
বকেয়া: ৳${parseFloat(job.total_bill) - parseFloat(job.advance_paid)}
লাইভ ট্র্যাকিং: ${url}`
      : `Hello ${job.customer_name},
Service: ${job.service_type}
Job No: ${job.job_number}
Total: ৳${job.total_bill}
Paid: ৳${job.advance_paid}
Due: ৳${parseFloat(job.total_bill) - parseFloat(job.advance_paid)}
Track: ${url}`;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'প্রিন্টিং ও সাইবার সেবা' : 'Printing & Cyber Seba'} />
        <Appbar.Action icon="refresh" onPress={fetchJobs} />
        <PageGuideButton pageKey="/app/service/jobs" />
      </Appbar.Header>

      <View style={{ padding: 12 }}>
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'জব নং, নাম বা ফোন দিয়ে খুঁজুন...' : 'Search by Job#, Name, Phone...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          right={search ? <TextInput.Icon icon="close" onPress={() => setSearch('')} /> : undefined}
          style={{ height: 44, backgroundColor: theme.colors.surface, marginBottom: 8 }}
          dense
        />

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {['all', 'pending', 'processing', 'ready', 'delivered'].map((st) => (
            <Chip
              key={st}
              selected={statusFilter === st}
              onPress={() => setStatusFilter(st)}
              style={{ backgroundColor: statusFilter === st ? '#6366f1' : theme.colors.surface }}
              textStyle={{ color: statusFilter === st ? '#ffffff' : theme.colors.onSurface, fontWeight: '700', fontSize: 12 }}
            >
              {st === 'all' ? (isBN ? 'সব' : 'All') : isBN ? STATUS_CONFIG[st]?.labelBn : STATUS_CONFIG[st]?.labelEn}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
          {jobs.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <MaterialCommunityIcons name="printer-pos" size={54} color="#94a3b8" />
              <Text style={{ marginTop: 12, color: '#64748b', fontWeight: '700' }}>
                {isBN ? 'কোনো জব শিট পাওয়া যায়নি।' : 'No service jobs found.'}
              </Text>
            </View>
          ) : (
            jobs.map((job) => {
              const st = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
              const due = Math.max(0, parseFloat(job.total_bill) - parseFloat(job.advance_paid));
              return (
                <Card
                  key={job.id}
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
                      <Text style={{ fontWeight: '800', fontSize: 15, color: theme.colors.onSurface }}>
                        {job.job_number}
                      </Text>
                      <View style={{ backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                        <Text style={{ color: st.color, fontWeight: '800', fontSize: 11 }}>
                          {isBN ? st.labelBn : st.labelEn}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#4338ca', marginBottom: 4 }}>
                      {job.service_type}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <MaterialCommunityIcons name="account" size={15} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' }}>
                        {job.customer_name} ({job.customer_phone})
                      </Text>
                    </View>

                    {!!job.delivery_date && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <MaterialCommunityIcons name="calendar-clock" size={15} color="#64748b" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                          {isBN ? 'ডেলিভারি তারিখ: ' : 'Delivery: '}
                          {job.delivery_date.slice(0, 10)}
                        </Text>
                      </View>
                    )}

                    <Divider style={{ marginVertical: 8 }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{isBN ? 'মোট বিল' : 'Total Bill'}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.onSurface }}>৳{job.total_bill}</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{isBN ? 'পরিশোধ' : 'Paid'}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#16a34a' }}>৳{job.advance_paid}</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{isBN ? 'বকেয়া' : 'Due'}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: due > 0 ? '#ef4444' : '#64748b' }}>
                          ৳{due.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
                      <TouchableOpacity
                        style={{ padding: 8, backgroundColor: '#f0fdf4', borderRadius: 8 }}
                        onPress={() => sendWhatsAppNotice(job)}
                      >
                        <MaterialCommunityIcons name="whatsapp" size={18} color="#16a34a" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 8, backgroundColor: '#eff6ff', borderRadius: 8 }}
                        onPress={() => shareTrackingLink(job)}
                      >
                        <MaterialCommunityIcons name="share-variant" size={18} color="#2563eb" />
                      </TouchableOpacity>
                      {due > 0 && (
                        <TouchableOpacity
                          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fef3c7', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => {
                            setSelectedJob(job);
                            setPaymentAmount(String(due));
                            setShowPaymentModal(true);
                          }}
                        >
                          <MaterialCommunityIcons name="cash" size={16} color="#d97706" style={{ marginRight: 4 }} />
                          <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 12 }}>{isBN ? 'আদায়' : 'Pay'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e0e7ff', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setSelectedJob(job);
                          setShowStatusModal(true);
                        }}
                      >
                        <MaterialCommunityIcons name="pencil" size={16} color="#4338ca" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#4338ca', fontWeight: '700', fontSize: 12 }}>{isBN ? 'স্ট্যাটাস' : 'Status'}</Text>
                      </TouchableOpacity>
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Floating Create Button */}
      <FAB
        icon="plus"
        label={isBN ? 'নতুন জব শিট' : 'New Job'}
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 10,
          backgroundColor: '#6366f1',
        }}
        color="#ffffff"
        onPress={() => setShowAddModal(true)}
      />

      {/* Add Job Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 16,
            padding: 16,
            borderRadius: 16,
            maxHeight: '90%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12, color: theme.colors.onSurface }}>
              ⚡ {isBN ? 'নতুন প্রিন্ট ও ডিজিটাল জব শিট' : 'New Service Job Sheet'}
            </Text>

            {/* Presets */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>
              {isBN ? 'দ্রুত সেবা সিলেক্ট করুন (1-Click Presets):' : 'Quick Presets:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              {[
                { id: 'passport_5y', label: '🛂 ৫ বছর পাসপোর্ট' },
                { id: 'passport_10y', label: '🛂 ১০ বছর পাসপোর্ট' },
                { id: 'police_clearance', label: '👮 পুলিশ ক্লিয়ারেন্স' },
                { id: 'nid', label: '🪪 এনআইডি রি-ইস্যু' },
                { id: 'banner', label: '🪧 পিভিসি ব্যানার' },
                { id: 'custom', label: '🛠️ কাস্টম সেবা' },
              ].map((p) => (
                <Chip
                  key={p.id}
                  selected={selectedPreset === p.id}
                  onPress={() => applyPreset(p.id)}
                  style={{ backgroundColor: selectedPreset === p.id ? '#4f46e5' : '#f1f5f9' }}
                  textStyle={{ color: selectedPreset === p.id ? '#ffffff' : '#1e293b', fontWeight: '700', fontSize: 11 }}
                >
                  {p.label}
                </Chip>
              ))}
            </ScrollView>

            {selectedPreset === 'banner' && (
              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  {isBN ? '📐 ব্যানার সাইজ ও রেট ক্যালকুলেটর:' : 'Banner Size Calculator:'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    mode="outlined"
                    label={isBN ? 'প্রস্থ (ft)' : 'Width (ft)'}
                    value={bannerWidth}
                    onChangeText={setBannerWidth}
                    keyboardType="numeric"
                    style={{ flex: 1, height: 40 }}
                    dense
                  />
                  <TextInput
                    mode="outlined"
                    label={isBN ? 'উচ্চতা (ft)' : 'Height (ft)'}
                    value={bannerHeight}
                    onChangeText={setBannerHeight}
                    keyboardType="numeric"
                    style={{ flex: 1, height: 40 }}
                    dense
                  />
                  <TextInput
                    mode="outlined"
                    label={isBN ? 'রেট (৳/sqft)' : 'Rate'}
                    value={bannerRate}
                    onChangeText={setBannerRate}
                    keyboardType="numeric"
                    style={{ flex: 1, height: 40 }}
                    dense
                  />
                </View>
                <Button mode="contained-tonal" onPress={() => applyPreset('banner')} style={{ marginTop: 6 }} compact>
                  {isBN ? 'হিসাব আপডেট করুন' : 'Recalculate'}
                </Button>
              </View>
            )}

            <TextInput
              mode="outlined"
              label={isBN ? 'গ্রাহকের নাম *' : 'Customer Name *'}
              value={form.customer_name}
              onChangeText={(t) => setForm(prev => ({ ...prev, customer_name: t }))}
              style={{ marginBottom: 8 }}
              dense
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'মোবাইল নম্বর *' : 'Phone Number *'}
              value={form.customer_phone}
              onChangeText={(t) => setForm(prev => ({ ...prev, customer_phone: t }))}
              keyboardType="phone-pad"
              style={{ marginBottom: 8 }}
              dense
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'সেবার বিবরণ' : 'Service Type'}
              value={form.service_type}
              onChangeText={(t) => setForm(prev => ({ ...prev, service_type: t }))}
              style={{ marginBottom: 8 }}
              dense
            />

            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <TextInput
                mode="outlined"
                label={isBN ? 'সরকারি ফি (৳)' : 'Govt Fee (৳)'}
                value={form.govt_fee}
                onChangeText={(t) => setForm(prev => ({ ...prev, govt_fee: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
              <TextInput
                mode="outlined"
                label={isBN ? 'সার্ভিস চার্জ (৳)' : 'Service Fee (৳)'}
                value={form.service_charge}
                onChangeText={(t) => setForm(prev => ({ ...prev, service_charge: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <TextInput
                mode="outlined"
                label={isBN ? 'ফিনিশিং চার্জ (৳)' : 'Finishing (৳)'}
                value={form.finishing_charge}
                onChangeText={(t) => setForm(prev => ({ ...prev, finishing_charge: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
              <TextInput
                mode="outlined"
                label={isBN ? 'ডিসকাউন্ট (৳)' : 'Discount (৳)'}
                value={form.discount}
                onChangeText={(t) => setForm(prev => ({ ...prev, discount: t }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
            </View>

            <TextInput
              mode="outlined"
              label={isBN ? 'অগ্রিম গ্রহণ (৳)' : 'Advance Paid (৳)'}
              value={form.advance_paid}
              onChangeText={(t) => setForm(prev => ({ ...prev, advance_paid: t }))}
              keyboardType="numeric"
              style={{ marginBottom: 12 }}
              dense
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button mode="text" onPress={() => setShowAddModal(false)}>
                {isBN ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button mode="contained" onPress={handleCreateJob} loading={creatingJob} buttonColor="#6366f1">
                {isBN ? 'জব শিট সংরক্ষণ' : 'Save Job'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Update Status Modal */}
      <Portal>
        <Modal
          visible={showStatusModal}
          onDismiss={() => setShowStatusModal(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 24,
            padding: 20,
            borderRadius: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 14, color: theme.colors.onSurface }}>
            🔄 {isBN ? 'কাজের স্ট্যাটাস পরিবর্তন' : 'Change Job Status'}
          </Text>
          {['pending', 'processing', 'ready', 'delivered', 'cancelled'].map((stKey) => {
            const cfg = STATUS_CONFIG[stKey];
            return (
              <TouchableOpacity
                key={stKey}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: cfg.bg,
                  marginBottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onPress={() => handleUpdateStatus(stKey)}
              >
                <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 14 }}>
                  {isBN ? cfg.labelBn : cfg.labelEn}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={cfg.color} />
              </TouchableOpacity>
            );
          })}
        </Modal>
      </Portal>

      {/* Payment Modal */}
      <Portal>
        <Modal
          visible={showPaymentModal}
          onDismiss={() => setShowPaymentModal(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 24,
            padding: 20,
            borderRadius: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 10, color: theme.colors.onSurface }}>
            💰 {isBN ? 'বকেয়া বিল গ্রহণ' : 'Collect Due Payment'}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {selectedJob?.job_number} - {selectedJob?.customer_name}
          </Text>
          <TextInput
            mode="outlined"
            label={isBN ? 'পরিশোধের পরিমাণ (৳)' : 'Payment Amount (৳)'}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            style={{ marginBottom: 16 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button mode="text" onPress={() => setShowPaymentModal(false)}>
              {isBN ? 'বাতিল' : 'Cancel'}
            </Button>
            <Button mode="contained" onPress={handleAddPayment} loading={submittingPayment} buttonColor="#16a34a">
              {isBN ? 'পেমেন্ট নিশ্চিত' : 'Confirm'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
