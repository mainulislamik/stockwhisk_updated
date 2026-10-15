import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Modal, Portal, Divider, useTheme, Searchbar, Badge } from 'react-native-paper';
import * as Print from 'expo-print';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch (e) {}
}

export type AlterationItem = {
  id: number;
  product_name: string;
  variation_name?: string;
  quantity: number | string;
};

export type AlterationSale = {
  id: number;
  invoice_no: string;
  sale_date: string;
  customer_name: string;
  customer_phone: string;
  total: string | number;
  alteration_notes: string;
  alteration_status: string;
  alteration_due_date: string | null;
  tailor_name: string;
  alteration_charge: string | number;
  items: AlterationItem[];
  created_at: string;
};

const STATUS_CONFIG: Record<string, { labelBn: string; labelEn: string; color: string; bg: string; icon: string }> = {
  pending: { labelBn: 'অপেক্ষমাণ', labelEn: 'Pending', color: '#d97706', bg: '#fef3c7', icon: 'clock-outline' },
  in_progress: { labelBn: 'কাজ চলছে', labelEn: 'In Progress', color: '#2563eb', bg: '#dbeafe', icon: 'content-cut' },
  ready: { labelBn: 'প্রস্তুত (Ready)', labelEn: 'Ready', color: '#16a34a', bg: '#dcfce7', icon: 'shopping-outline' },
  delivered: { labelBn: 'ডেলিভার্ড', labelEn: 'Delivered', color: '#64748b', bg: '#f1f5f9', icon: 'package-variant-closed' },
};

export default function AlterationsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [alterations, setAlterations] = useState<AlterationSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit Modal State
  const [editingSale, setEditingSale] = useState<AlterationSale | null>(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editTailor, setEditTailor] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  async function loadAlterations() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get<AlterationSale[]>(`/sales/alterations/?${params.toString()}`);
      setAlterations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load alterations:', err);
      setAlterations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadAlterations();
  }, [statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlterations();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return alterations;
    const q = search.toLowerCase();
    return alterations.filter(
      (a) =>
        (a.invoice_no && a.invoice_no.toLowerCase().includes(q)) ||
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.customer_phone && a.customer_phone.includes(q)) ||
        (a.tailor_name && a.tailor_name.toLowerCase().includes(q)) ||
        (a.alteration_notes && a.alteration_notes.toLowerCase().includes(q))
    );
  }, [alterations, search]);

  const counts = useMemo(() => {
    return {
      all: alterations.length,
      pending: alterations.filter((a) => a.alteration_status === 'pending').length,
      in_progress: alterations.filter((a) => a.alteration_status === 'in_progress').length,
      ready: alterations.filter((a) => a.alteration_status === 'ready').length,
      delivered: alterations.filter((a) => a.alteration_status === 'delivered').length,
    };
  }, [alterations]);

  function isOverdue(dueDateStr: string | null, status: string) {
    if (!dueDateStr || status === 'delivered') return false;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  async function quickUpdateStatus(saleId: number, newStatus: string) {
    try {
      const res = await api.post<AlterationSale>(`/sales/alterations/${saleId}/update_status/`, {
        status: newStatus,
      });
      setAlterations((prev) => prev.map((a) => (a.id === saleId ? { ...a, ...res.data } : a)));
    } catch (err) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'স্ট্যাটাস পরিবর্তন করা সম্ভব হয়নি।' : 'Failed to update status.');
    }
  }

  function openEditModal(sale: AlterationSale) {
    setEditingSale(sale);
    setEditStatus(sale.alteration_status || 'pending');
    setEditTailor(sale.tailor_name || '');
    setEditDueDate(sale.alteration_due_date || '');
    setEditNotes(sale.alteration_notes || '');
  }

  async function handleSaveEdit() {
    if (!editingSale) return;
    setSavingEdit(true);
    try {
      const res = await api.post<AlterationSale>(`/sales/alterations/${editingSale.id}/update_status/`, {
        status: editStatus,
        tailor_name: editTailor,
        due_date: editDueDate || null,
        notes: editNotes,
      });
      setAlterations((prev) => prev.map((a) => (a.id === editingSale.id ? { ...a, ...res.data } : a)));
      setEditingSale(null);
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'অল্টারেশন তথ্য সফলভাবে সংরক্ষিত হয়েছে।' : 'Saved successfully.');
    } catch (err) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'সংরক্ষণ ব্যর্থ হয়েছে।' : 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  function sendWhatsAppAlert(sale: AlterationSale) {
    if (!sale.customer_phone) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Alert', isBN ? 'গ্রাহকের ফোন নম্বর নেই।' : 'No phone number available.');
      return;
    }
    const cleanPhone = sale.customer_phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const shopName = (user as any)?.shop_name || 'আমাদের আউটলেট';
    const msg = `আসসালামু আলাইকুম ${sale.customer_name || 'সম্মানিত গ্রাহক'}, ${shopName} থেকে জানানো যাচ্ছে যে আপনার ইনভয়েস #${sale.invoice_no} এর পোশাকের অল্টারেশন / ফিটিং প্রস্তুত হয়েছে। অনুগ্রহ করে আউটলেট থেকে সংগ্রহ করার অনুরোধ রইল। ধন্যবাদ!`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'হোয়াটসঅ্যাপ চালু করা যায়নি।' : 'Could not launch WhatsApp.');
    });
  }

  async function handlePrintTailorSlip(sale: AlterationSale) {
    const shopName = (user as any)?.shop_name || 'StockWhisk Fashion';
    const itemsHtml = (sale.items || []).map((it) => `
      <div style="margin-bottom: 4px; font-size: 13px;">• ${it.product_name} ${it.variation_name ? `(${it.variation_name})` : ''}</div>
    `).join('');
    const chargeHtml = Number(sale.alteration_charge) > 0 ? `
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 6px; font-size: 13px;">
        <span>ফিটিং চার্জ:</span>
        <span>৳${sale.alteration_charge}</span>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tailor Slip #${sale.invoice_no}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              color: #000;
              padding: 12px;
              margin: 0;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .box { border: 1px solid #000; padding: 8px; margin: 8px 0; border-radius: 4px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">${shopName}</div>
          <div class="center" style="font-size: 12px; margin-top: 2px;">✂️ টেইলারিং ও অল্টারেশন স্লিপ ✂️</div>
          <div class="divider"></div>
          <div class="row"><span>চালান #:</span><span class="bold">${sale.invoice_no}</span></div>
          <div class="row"><span>তারিখ:</span><span>${sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : new Date().toLocaleDateString()}</span></div>
          <div class="row"><span>গ্রাহক:</span><span class="bold">${sale.customer_name || 'ওয়াক-ইন'}</span></div>
          <div class="row"><span>ফোন:</span><span>${sale.customer_phone || '—'}</span></div>
          <div class="row"><span>দর্জি / মাস্টার:</span><span class="bold">${sale.tailor_name || 'অনির্দিষ্ট'}</span></div>
          <div class="row"><span>ডেলিভারি তারিখ:</span><span class="bold" style="color: #b91c1c;">${sale.alteration_due_date || '—'}</span></div>
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 4px;">পোশাক বিবরণ:</div>
          ${itemsHtml}
          <div class="box">
            <div class="bold">ফিটিং নির্দেশনা / নোট:</div>
            <div style="margin-top: 3px;">${sale.alteration_notes || 'কোনো নোট দেওয়া হয়নি'}</div>
          </div>
          ${chargeHtml}
          <div class="divider"></div>
          <div class="center" style="font-size: 11px; color: #444; margin-top: 6px;">
            StockWhisk Apparel Engine • কাপড়ে পিন করে রাখুন
          </div>
        </body>
      </html>
    `;
    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error('Print error:', err);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <Appbar.Header style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={isBN ? 'পোশাক অল্টারেশন ও ফিটিং' : 'Garment Alterations'}
          subtitle={isBN ? 'দর্জি ট্র্যাকিং ও ডেলিভারি বোর্ড' : 'Tailoring & Delivery Board'}
        />
        <PageGuideButton pageKey="/app/alterations" />
      </Appbar.Header>

      {/* Search & Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
        <Searchbar
          placeholder={isBN ? 'চালান, কাস্টমার, দর্জি বা নোট খুঁজুন...' : 'Search invoice, customer, tailor...'}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ fontSize: 13 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipsContainer}>
          <Chip
            selected={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
            style={[styles.statusChip, statusFilter === 'all' && styles.activeChip]}
            textStyle={{ fontSize: 12, fontWeight: statusFilter === 'all' ? 'bold' : 'normal' }}
          >
            {isBN ? `সব (${counts.all})` : `All (${counts.all})`}
          </Chip>
          <Chip
            selected={statusFilter === 'pending'}
            onPress={() => setStatusFilter('pending')}
            style={[styles.statusChip, statusFilter === 'pending' && styles.activeChip]}
            textStyle={{ fontSize: 12, color: '#d97706', fontWeight: statusFilter === 'pending' ? 'bold' : 'normal' }}
          >
            {isBN ? `🕒 অপেক্ষমাণ (${counts.pending})` : `Pending (${counts.pending})`}
          </Chip>
          <Chip
            selected={statusFilter === 'in_progress'}
            onPress={() => setStatusFilter('in_progress')}
            style={[styles.statusChip, statusFilter === 'in_progress' && styles.activeChip]}
            textStyle={{ fontSize: 12, color: '#2563eb', fontWeight: statusFilter === 'in_progress' ? 'bold' : 'normal' }}
          >
            {isBN ? `✂️ কাজ চলছে (${counts.in_progress})` : `In Progress (${counts.in_progress})`}
          </Chip>
          <Chip
            selected={statusFilter === 'ready'}
            onPress={() => setStatusFilter('ready')}
            style={[styles.statusChip, statusFilter === 'ready' && styles.activeChip]}
            textStyle={{ fontSize: 12, color: '#16a34a', fontWeight: statusFilter === 'ready' ? 'bold' : 'normal' }}
          >
            {isBN ? `🛍️ প্রস্তুত (${counts.ready})` : `Ready (${counts.ready})`}
          </Chip>
          <Chip
            selected={statusFilter === 'delivered'}
            onPress={() => setStatusFilter('delivered')}
            style={[styles.statusChip, statusFilter === 'delivered' && styles.activeChip]}
            textStyle={{ fontSize: 12, color: '#64748b', fontWeight: statusFilter === 'delivered' ? 'bold' : 'normal' }}
          >
            {isBN ? `📦 ডেলিভার্ড (${counts.delivered})` : `Delivered (${counts.delivered})`}
          </Chip>
        </ScrollView>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ marginTop: 12, color: '#64748b' }}>{isBN ? 'লোড হচ্ছে...' : 'Loading...'}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <MaterialCommunityIcons name="content-cut" size={64} color="#94a3b8" />
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 12, color: '#64748b' }}>
            {isBN ? 'কোনো অল্টারেশন অর্ডার পাওয়া যায়নি' : 'No alteration jobs found'}
          </Text>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
            {isBN
              ? 'POS স্ক্রিনে কাপড় বিক্রির সময় "অল্টারেশন / ফিটিং নোট" দিলে এখানে স্বয়ংক্রিয়ভাবে তালিকা আসবে।'
              : 'Add alteration notes during POS sales to manage them here.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filtered.map((item) => {
            const st = STATUS_CONFIG[item.alteration_status] || {
              labelBn: item.alteration_status || '—',
              labelEn: item.alteration_status || '—',
              color: '#64748b',
              bg: '#f1f5f9',
              icon: 'information-outline',
            };
            const overdue = isOverdue(item.alteration_due_date, item.alteration_status);

            return (
              <Card
                key={item.id}
                style={[
                  styles.card,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
                  overdue && { borderColor: '#ef4444', borderWidth: 1.5 },
                ]}
              >
                {/* Overdue Banner */}
                {overdue && (
                  <View style={styles.overdueBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#ffffff" />
                    <Text style={styles.overdueText}>
                      {isBN ? '⚠️ সময় উত্তীর্ণ! দ্রুত ডেলিভারি সম্পন্ন করুন' : '⚠️ Overdue! Please expedite delivery'}
                    </Text>
                  </View>
                )}

                <Card.Content style={{ paddingTop: overdue ? 8 : 14 }}>
                  {/* Header Row */}
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={[styles.invoiceNo, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                        #{item.invoice_no}
                      </Text>
                      <Text style={styles.dateText}>
                        {item.sale_date ? new Date(item.sale_date).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                    <Chip
                      icon={() => <MaterialCommunityIcons name={st.icon as any} size={14} color={st.color} />}
                      style={{ backgroundColor: st.bg, height: 28 }}
                      textStyle={{ color: st.color, fontSize: 11, fontWeight: 'bold' }}
                    >
                      {isBN ? st.labelBn : st.labelEn}
                    </Chip>
                  </View>

                  {/* Customer Info */}
                  <View style={styles.customerBox}>
                    <View style={styles.rowAligned}>
                      <MaterialCommunityIcons name="account" size={16} color="#6366f1" />
                      <Text style={[styles.custName, { color: isDarkMode ? '#e2e8f0' : '#1e293b' }]}>
                        {item.customer_name || (isBN ? 'ওয়াক-ইন কাস্টমার' : 'Walk-in Customer')}
                      </Text>
                    </View>
                    {item.customer_phone ? (
                      <TouchableOpacity
                        style={styles.rowAligned}
                        onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                      >
                        <MaterialCommunityIcons name="phone" size={14} color="#16a34a" />
                        <Text style={styles.custPhone}>{item.customer_phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Items List */}
                  {item.items && item.items.length > 0 && (
                    <View style={styles.itemsBox}>
                      <Text style={styles.itemsLabel}>{isBN ? 'পোশাক বিবরণ:' : 'Items:'}</Text>
                      {item.items.map((it) => (
                        <Text key={it.id} style={[styles.itemLine, { color: isDarkMode ? '#cbd5e1' : '#334155' }]}>
                          • {it.product_name} {it.variation_name ? `(${it.variation_name})` : ''}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Alteration Notes */}
                  <View style={[styles.notesBox, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}>
                    <View style={styles.rowAligned}>
                      <MaterialCommunityIcons name="ruler" size={16} color="#8b5cf6" />
                      <Text style={[styles.notesTitle, { color: isDarkMode ? '#c084fc' : '#6b21a8' }]}>
                        {isBN ? 'ফিটিং নির্দেশনা:' : 'Fitting Notes:'}
                      </Text>
                    </View>
                    <Text style={[styles.notesContent, { color: isDarkMode ? '#e2e8f0' : '#334155' }]}>
                      {item.alteration_notes || (isBN ? 'কোনো নির্দিষ্ট নোট নেই' : 'No instructions')}
                    </Text>
                  </View>

                  {/* Tailor & Due Date Row */}
                  <View style={styles.metaRow}>
                    <View style={styles.rowAligned}>
                      <MaterialCommunityIcons name="account-tie" size={16} color="#64748b" />
                      <Text style={styles.metaText}>
                        {isBN ? 'দর্জি: ' : 'Tailor: '}
                        <Text style={{ fontWeight: 'bold' }}>{item.tailor_name || (isBN ? 'অনির্দিষ্ট' : 'Unassigned')}</Text>
                      </Text>
                    </View>
                    <View style={styles.rowAligned}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color={overdue ? '#ef4444' : '#64748b'} />
                      <Text style={[styles.metaText, overdue && { color: '#ef4444', fontWeight: 'bold' }]}>
                        {isBN ? 'ডেলিভারি: ' : 'Due: '}
                        <Text style={{ fontWeight: 'bold' }}>{item.alteration_due_date || '—'}</Text>
                      </Text>
                    </View>
                  </View>

                  {Number(item.alteration_charge) > 0 && (
                    <View style={[styles.rowBetween, { marginTop: 8 }]}>
                      <Text style={styles.metaText}>{isBN ? 'ফিটিং চার্জ:' : 'Alteration Fee:'}</Text>
                      <Text style={[styles.chargeText, { color: '#16a34a' }]}>৳{item.alteration_charge}</Text>
                    </View>
                  )}

                  <Divider style={{ marginVertical: 12 }} />

                  {/* Status Progression Bar */}
                  <Text style={[styles.progressionLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                    {isBN ? 'দ্রুত স্ট্যাটাস পরিবর্তন করুন:' : 'Quick Status Change:'}
                  </Text>
                  <View style={styles.statusButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        item.alteration_status === 'pending' && { backgroundColor: '#fef3c7', borderColor: '#d97706' },
                      ]}
                      onPress={() => quickUpdateStatus(item.id, 'pending')}
                    >
                      <Text style={[styles.quickStatusText, item.alteration_status === 'pending' && { color: '#d97706', fontWeight: 'bold' }]}>
                        🕒 {isBN ? 'অপেক্ষমাণ' : 'Pending'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        item.alteration_status === 'in_progress' && { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
                      ]}
                      onPress={() => quickUpdateStatus(item.id, 'in_progress')}
                    >
                      <Text style={[styles.quickStatusText, item.alteration_status === 'in_progress' && { color: '#2563eb', fontWeight: 'bold' }]}>
                        ✂️ {isBN ? 'কাজ চলছে' : 'Working'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        item.alteration_status === 'ready' && { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
                      ]}
                      onPress={() => quickUpdateStatus(item.id, 'ready')}
                    >
                      <Text style={[styles.quickStatusText, item.alteration_status === 'ready' && { color: '#16a34a', fontWeight: 'bold' }]}>
                        🛍️ {isBN ? 'প্রস্তুত' : 'Ready'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        item.alteration_status === 'delivered' && { backgroundColor: '#f1f5f9', borderColor: '#64748b' },
                      ]}
                      onPress={() => quickUpdateStatus(item.id, 'delivered')}
                    >
                      <Text style={[styles.quickStatusText, item.alteration_status === 'delivered' && { color: '#64748b', fontWeight: 'bold' }]}>
                        📦 {isBN ? 'ডেলিভার্ড' : 'Delivered'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={[styles.rowBetween, { marginTop: 12 }]}>
                    <Button
                      mode="outlined"
                      icon="pencil"
                      compact
                      onPress={() => openEditModal(item)}
                      style={styles.actionBtn}
                      labelStyle={{ fontSize: 11 }}
                    >
                      {isBN ? 'সম্পাদনা' : 'Edit'}
                    </Button>

                    <Button
                      mode="outlined"
                      icon="printer"
                      compact
                      onPress={() => handlePrintTailorSlip(item)}
                      style={styles.actionBtn}
                      labelStyle={{ fontSize: 11 }}
                    >
                      {isBN ? 'টোকেন স্লিপ' : 'Tailor Slip'}
                    </Button>

                    {item.customer_phone ? (
                      <Button
                        mode="contained"
                        icon="whatsapp"
                        compact
                        buttonColor="#25D366"
                        textColor="#ffffff"
                        onPress={() => sendWhatsAppAlert(item)}
                        style={styles.actionBtn}
                        labelStyle={{ fontSize: 11 }}
                      >
                        {isBN ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}
                      </Button>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={!!editingSale}
          onDismiss={() => setEditingSale(null)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.rowAligned}>
              <MaterialCommunityIcons name="content-cut" size={20} color="#4f46e5" />
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                {isBN ? `অল্টারেশন সম্পাদন (#${editingSale?.invoice_no})` : `Edit Alteration (#${editingSale?.invoice_no})`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setEditingSale(null)}>
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.inputLabel}>{isBN ? 'কাজের স্ট্যাটাস:' : 'Alteration Status:'}</Text>
            <View style={styles.statusSelectRow}>
              {(['pending', 'in_progress', 'ready', 'delivered'] as const).map((s) => (
                <Chip
                  key={s}
                  selected={editStatus === s}
                  onPress={() => setEditStatus(s)}
                  style={[styles.modalChip, editStatus === s && { backgroundColor: '#4f46e5' }]}
                  textStyle={{ color: editStatus === s ? '#ffffff' : '#334155', fontSize: 11 }}
                >
                  {s === 'pending'
                    ? (isBN ? 'অপেক্ষমাণ' : 'Pending')
                    : s === 'in_progress'
                    ? (isBN ? 'কাজ চলছে' : 'In Progress')
                    : s === 'ready'
                    ? (isBN ? 'প্রস্তুত' : 'Ready')
                    : (isBN ? 'ডেলিভার্ড' : 'Delivered')}
                </Chip>
              ))}
            </View>

            <TextInput
              label={isBN ? 'দর্জি / মাস্টারের নাম' : 'Tailor / Master Name'}
              value={editTailor}
              onChangeText={setEditTailor}
              mode="outlined"
              style={styles.modalInput}
              placeholder={isBN ? 'যেমন: রফিক টেইলার' : 'e.g. Master Rafiq'}
            />

            <TextInput
              label={isBN ? 'ডেলিভারি তারিখ (YYYY-MM-DD)' : 'Due Date (YYYY-MM-DD)'}
              value={editDueDate}
              onChangeText={setEditDueDate}
              mode="outlined"
              style={styles.modalInput}
              placeholder="2026-10-20"
              right={
                <TextInput.Icon
                  icon="calendar"
                  onPress={() => {
                    if (DateTimePicker) setShowDatePicker(true);
                  }}
                />
              }
            />

            {showDatePicker && DateTimePicker && (
              <DateTimePicker
                value={editDueDate ? new Date(editDueDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event: any, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setEditDueDate(selectedDate.toISOString().split('T')[0]);
                  }
                }}
              />
            )}

            <TextInput
              label={isBN ? 'ফিটিং নির্দেশনা ও নোট' : 'Fitting Notes & Instructions'}
              value={editNotes}
              onChangeText={setEditNotes}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={[styles.modalInput, { minHeight: 90 }]}
              placeholder={isBN ? 'যেমন: কোমর ১ ইঞ্চি লুজ করতে হবে, হাতা ২ ইঞ্চি ছোট...' : 'e.g. Alter waist by 1 inch...'}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setEditingSale(null)} textColor="#64748b">
              {isBN ? 'বাতিল' : 'Cancel'}
            </Button>
            <Button
              mode="contained"
              buttonColor="#4f46e5"
              loading={savingEdit}
              disabled={savingEdit}
              onPress={handleSaveEdit}
            >
              {isBN ? 'সংরক্ষণ করুন' : 'Save Changes'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  filterBar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, elevation: 1 },
  searchbar: { elevation: 0, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  statusChipsContainer: { flexDirection: 'row', gap: 6, marginTop: 10, paddingBottom: 2 },
  statusChip: { height: 32, borderRadius: 16 },
  activeChip: { backgroundColor: '#e0e7ff' },
  listContent: { padding: 12, paddingBottom: 40 },
  card: { marginBottom: 12, borderRadius: 12, elevation: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  overdueBanner: {
    backgroundColor: '#ef4444',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overdueText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowAligned: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  invoiceNo: { fontSize: 15, fontWeight: 'bold' },
  dateText: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  customerBox: { marginTop: 10, padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.06)', borderRadius: 8, gap: 4 },
  custName: { fontSize: 13, fontWeight: 'bold' },
  custPhone: { fontSize: 12, color: '#16a34a', textDecorationLine: 'underline' },
  itemsBox: { marginTop: 8 },
  itemsLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 2 },
  itemLine: { fontSize: 12, lineHeight: 18 },
  notesBox: { marginTop: 8, padding: 8, borderRadius: 8 },
  notesTitle: { fontSize: 11, fontWeight: 'bold' },
  notesContent: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  metaText: { fontSize: 12, color: '#64748b' },
  chargeText: { fontSize: 14, fontWeight: 'bold' },
  progressionLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  statusButtonsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  quickStatusBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  quickStatusText: { fontSize: 10, color: '#64748b' },
  actionBtn: { borderRadius: 8 },
  modalContainer: { margin: 20, padding: 18, borderRadius: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 15, fontWeight: 'bold' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 6 },
  statusSelectRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  modalChip: { height: 32, borderRadius: 16 },
  modalInput: { marginBottom: 12, backgroundColor: 'transparent', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
});
