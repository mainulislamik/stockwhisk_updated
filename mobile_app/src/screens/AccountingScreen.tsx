import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, FlatList, TextInput as RNTextInput } from 'react-native';
import { Appbar, Text, Card, useTheme, Divider, Chip, ActivityIndicator, Surface, Button, TextInput, IconButton, SegmentedButtons } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

type ProfitData = {
  revenue: string;
  returns: string;
  cogs: string;
  gross_profit: string;
  expenses: string;
  net_profit: string;
  sales_count: number;
  payment_methods?: Record<string, string>;
};

type PositionData = {
  cash_balance: string;
  bkash_balance?: string;
  nagad_balance?: string;
  bank_balance: string;
  card_balance?: string;
  total_liquid_cash?: string;
  receivables: string;
  payables: string;
};

type LedgerEntry = {
  id: number;
  account: string;
  account_display?: string;
  amount: string;
  source_type: string;
  source_id?: number;
  description: string;
  created_at: string;
};

type AccountTransfer = {
  id: number;
  from_account: string;
  from_account_display?: string;
  to_account: string;
  to_account_display?: string;
  amount: string;
  transferred_on: string;
  reference?: string;
  note?: string;
  created_at: string;
};

const ACCOUNT_CHOICES = [
  { key: 'cash', labelBN: 'ক্যাশ (Cash)', labelEN: 'Cash Drawer' },
  { key: 'bank', labelBN: 'ব্যাংক একাউন্ট (Bank)', labelEN: 'Bank Account' },
  { key: 'bkash', labelBN: 'বিকাশ (bKash)', labelEN: 'bKash Merchant/Personal' },
  { key: 'nagad', labelBN: 'নগদ (Nagad)', labelEN: 'Nagad Account' },
  { key: 'card', labelBN: 'কার্ড পিওএস (Card POS)', labelEN: 'Card POS' },
];

export default function AccountingScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'transfers'>('overview');

  // Overview Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [position, setPosition] = useState<PositionData | null>(null);

  // Ledger Tab State
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState<string>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Transfers Tab State
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [fromAccount, setFromAccount] = useState('cash');
  const [toAccount, setToAccount] = useState('bank');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Fetch P&L Overview
  const fetchOverview = async () => {
    setError('');
    try {
      let startStr = '';
      let endStr = '';
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      if (dateFilter === 'today') {
        startStr = `${todayStr}T00:00:00`;
        endStr = `${todayStr}T23:59:59`;
      } else if (dateFilter === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const dYear = d.getFullYear();
        const dMonth = String(d.getMonth() + 1).padStart(2, '0');
        const dDay = String(d.getDate()).padStart(2, '0');
        startStr = `${dYear}-${dMonth}-${dDay}T00:00:00`;
        endStr = `${todayStr}T23:59:59`;
      } else if (dateFilter === 'month') {
        startStr = `${year}-${month}-01T00:00:00`;
        endStr = `${todayStr}T23:59:59`;
      }

      const params: any = {};
      if (startStr) params.start = startStr;
      if (endStr) params.end = endStr;

      const [profitRes, posRes] = await Promise.all([
        api.get('/accounting/reports/profit/', { params }).catch(() => ({ data: null })),
        api.get('/accounting/reports/position/').catch(() => ({ data: null })),
      ]);

      if (profitRes.data) setProfit(profitRes.data);
      if (posRes.data) setPosition(posRes.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || (isBN ? 'ডাটা লোড করা যায়নি।' : 'Failed to load data.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch General Ledger
  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const params: any = {};
      if (ledgerAccount !== 'all') params.account = ledgerAccount;
      if (ledgerSearch.trim()) params.search = ledgerSearch.trim();
      const res = await api.get('/accounting/ledger-entries/', { params });
      const data = res.data?.results || res.data || [];
      setLedgerEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load ledger', e);
    } finally {
      setLedgerLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch Transfers
  const fetchTransfers = async () => {
    setTransfersLoading(true);
    try {
      const res = await api.get('/accounting/transfers/');
      const data = res.data?.results || res.data || [];
      setTransfers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load transfers', e);
    } finally {
      setTransfersLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      setLoading(true);
      fetchOverview();
    } else if (activeTab === 'ledger') {
      fetchLedger();
    } else if (activeTab === 'transfers') {
      fetchTransfers();
    }
  }, [activeTab, dateFilter, ledgerAccount]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'ledger') fetchLedger();
    else if (activeTab === 'transfers') fetchTransfers();
  };

  // Submit new transfer
  const handleSaveTransfer = async () => {
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Alert', isBN ? 'সঠিক ট্রান্সফার পরিমাণ দিন।' : 'Enter a valid transfer amount.');
      return;
    }
    if (fromAccount === toAccount) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Alert', isBN ? 'উৎস ও গন্তব্য একাউন্ট ভিন্ন হতে হবে।' : 'Source and destination accounts must be different.');
      return;
    }

    setTransferSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await api.post('/accounting/transfers/', {
        from_account: fromAccount,
        to_account: toAccount,
        amount: amt,
        transferred_on: todayStr,
        note: transferNote.trim()
      });

      Alert.alert(isBN ? 'সফল হয়েছে!' : 'Success!', isBN ? 'ফান্ড ট্রান্সফার সফলভাবে সম্পন্ন হয়েছে।' : 'Transfer completed.');
      setTransferModalVisible(false);
      setTransferAmount('');
      setTransferNote('');
      fetchTransfers();
      fetchOverview();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || (isBN ? 'ট্রান্সফার ব্যর্থ হয়েছে।' : 'Transfer failed');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', msg);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Delete transfer
  const handleDeleteTransfer = (id: number) => {
    Alert.alert(
      isBN ? 'ট্রান্সফার মুছে ফেলা' : 'Delete Transfer',
      isBN ? 'আপনি কি এই ট্রান্সফার রেকর্ডটি মুছে ফেলতে চান? এতে ব্যালেন্স পূর্বাবস্থায় ফিরবে।' : 'Are you sure you want to delete this transfer?',
      [
        { text: isBN ? 'বাতিল' : 'Cancel', style: 'cancel' },
        {
          text: isBN ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/accounting/transfers/${id}/`);
              fetchTransfers();
              fetchOverview();
            } catch (err: any) {
              Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'ট্রান্সফার মোছা সম্ভব হয়নি।' : 'Failed to delete');
            }
          }
        }
      ]
    );
  };

  const revenueNum = Number(profit?.revenue || 0);
  const returnsNum = Number(profit?.returns || 0);
  const cogsNum = Number(profit?.cogs || 0);
  const grossProfitNum = Number(profit?.gross_profit || (revenueNum - returnsNum - cogsNum));
  const expensesNum = Number(profit?.expenses || 0);
  const netProfitNum = Number(profit?.net_profit || (grossProfitNum - expensesNum));

  const cashBal = Number(position?.cash_balance || 0);
  const bkashBal = Number(position?.bkash_balance || 0);
  const nagadBal = Number(position?.nagad_balance || 0);
  const bankBal = Number(position?.bank_balance || 0);
  const cardBal = Number(position?.card_balance || 0);
  const totalLiquid = position?.total_liquid_cash !== undefined 
    ? Number(position.total_liquid_cash) 
    : (cashBal + bkashBal + nagadBal + bankBal + cardBal);
  const receivables = Number(position?.receivables || 0);
  const payables = Number(position?.payables || 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'একাউন্টিং ও অর্থায়ন' : 'Accounting & Finance'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/accounting" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {/* Tabs Header */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, backgroundColor: theme.colors.surface }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          buttons={[
            { value: 'overview', label: isBN ? 'ওভারভিউ' : 'Overview', icon: 'chart-line' },
            { value: 'ledger', label: isBN ? 'লেজার' : 'Ledger', icon: 'book-open-outline' },
            { value: 'transfers', label: isBN ? 'ট্রান্সফার' : 'Transfers', icon: 'bank-transfer' },
          ]}
        />
      </View>

      {/* ================= TAB 1: OVERVIEW & P&L ================= */}
      {activeTab === 'overview' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Date Filter Chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {[
              { key: 'today', label: isBN ? 'আজকের' : 'Today' },
              { key: '7days', label: isBN ? 'গত ৭ দিন' : 'Last 7 Days' },
              { key: 'month', label: isBN ? 'চলতি মাস' : 'This Month' },
              { key: 'all', label: isBN ? 'সর্বমোট' : 'All Time' },
            ].map(f => (
              <Chip
                key={f.key}
                selected={dateFilter === f.key}
                onPress={() => setDateFilter(f.key as any)}
                style={{ backgroundColor: dateFilter === f.key ? theme.colors.primaryContainer : theme.colors.surfaceVariant }}
                textStyle={{ fontWeight: dateFilter === f.key ? 'bold' : 'normal' }}
              >
                {f.label}
              </Chip>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Net Profit Banner */}
              <Card style={{ backgroundColor: netProfitNum >= 0 ? '#10b981' : '#ef4444', marginBottom: 16, borderRadius: 12 }}>
                <Card.Content style={{ paddingVertical: 16 }}>
                  <Text style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {isBN ? 'নিট লাভ / ক্ষতি (Net Profit)' : 'Net Profit / Loss'}
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 4 }}>
                    ৳ {netProfitNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 }}>
                    {isBN 
                      ? `মোট বিক্রি ${profit?.sales_count || 0} টি ইনভয়েস থেকে` 
                      : `From ${profit?.sales_count || 0} sale invoices`}
                  </Text>
                </Card.Content>
              </Card>

              {/* Profit & Loss Breakdown */}
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: theme.colors.onBackground }}>
                {isBN ? 'আয় ও ব্যয়ের বিবরণী' : 'Income & Expense Breakdown'}
              </Text>
              
              <Surface style={{ borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>{isBN ? 'মোট বিক্রয় (Revenue)' : 'Total Revenue'}</Text>
                  <Text style={{ fontWeight: 'bold', color: '#10b981' }}>+ ৳ {revenueNum.toLocaleString()}</Text>
                </View>
                {returnsNum > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>{isBN ? 'ফেরত / রিটার্ন (Returns)' : 'Sales Returns'}</Text>
                    <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>- ৳ {returnsNum.toLocaleString()}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>{isBN ? 'পণ্যের ক্রয়মূল্য (COGS)' : 'Cost of Goods Sold'}</Text>
                  <Text style={{ fontWeight: 'bold', color: '#f59e0b' }}>- ৳ {cogsNum.toLocaleString()}</Text>
                </View>
                <Divider style={{ marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ fontWeight: 'bold' }}>{isBN ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}</Text>
                  <Text style={{ fontWeight: 'bold', color: grossProfitNum >= 0 ? '#10b981' : '#ef4444' }}>
                    ৳ {grossProfitNum.toLocaleString()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>{isBN ? 'দোকানের খরচ (Operating Expenses)' : 'Shop Expenses'}</Text>
                  <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>- ৳ {expensesNum.toLocaleString()}</Text>
                </View>
                <Divider style={{ marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{isBN ? 'নিট লাভ (Net Profit)' : 'Net Profit'}</Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: netProfitNum >= 0 ? '#10b981' : '#ef4444' }}>
                    ৳ {netProfitNum.toLocaleString()}
                  </Text>
                </View>
              </Surface>

              {/* Financial Position (Liquid Balances) */}
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: theme.colors.onBackground }}>
                {isBN ? 'বর্তমান নগদ ও ব্যাংক স্থিতি' : 'Cash & Liquid Balance'}
              </Text>

              <Surface style={{ borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>{isBN ? 'সর্বমোট তরল ক্যাশ' : 'Total Liquid Cash'}</Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#3b82f6' }}>৳ {totalLiquid.toLocaleString()}</Text>
                </View>
                <Divider style={{ marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>💵 {isBN ? 'ক্যাশ ড্রয়ার' : 'Cash Drawer'}</Text>
                  <Text style={{ fontWeight: 'bold' }}>৳ {cashBal.toLocaleString()}</Text>
                </View>
                {bkashBal > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>📱 {isBN ? 'বিকাশ ব্যালেন্স' : 'bKash Balance'}</Text>
                    <Text style={{ fontWeight: 'bold' }}>৳ {bkashBal.toLocaleString()}</Text>
                  </View>
                )}
                {nagadBal > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>📱 {isBN ? 'নগদ ব্যালেন্স' : 'Nagad Balance'}</Text>
                    <Text style={{ fontWeight: 'bold' }}>৳ {nagadBal.toLocaleString()}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>🏦 {isBN ? 'ব্যাংক একাউন্ট' : 'Bank Balance'}</Text>
                  <Text style={{ fontWeight: 'bold' }}>৳ {bankBal.toLocaleString()}</Text>
                </View>
              </Surface>

              {/* Receivables & Payables */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Card style={{ flex: 1, backgroundColor: '#fef3c7', borderRadius: 12 }}>
                  <Card.Content style={{ paddingVertical: 12 }}>
                    <Text style={{ fontSize: 11, color: '#b45309', fontWeight: 'bold' }}>{isBN ? 'কাস্টমার বকেয়া' : 'Receivables'}</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d97706', marginTop: 4 }}>
                      ৳ {receivables.toLocaleString()}
                    </Text>
                  </Card.Content>
                </Card>

                <Card style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 12 }}>
                  <Card.Content style={{ paddingVertical: 12 }}>
                    <Text style={{ fontSize: 11, color: '#b91c1c', fontWeight: 'bold' }}>{isBN ? 'সাপ্লায়ার দেনা' : 'Payables'}</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginTop: 4 }}>
                      ৳ {payables.toLocaleString()}
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ================= TAB 2: GENERAL LEDGER ================= */}
      {activeTab === 'ledger' && (
        <View style={{ flex: 1, padding: 12 }}>
          {/* Account Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { key: 'all', label: isBN ? 'সব একাউন্ট' : 'All Accounts' },
                { key: 'cash', label: isBN ? '💵 ক্যাশ' : '💵 Cash' },
                { key: 'bank', label: isBN ? '🏦 ব্যাংক' : '🏦 Bank' },
                { key: 'bkash', label: isBN ? '📱 বিকাশ' : '📱 bKash' },
                { key: 'nagad', label: isBN ? '📱 নগদ' : '📱 Nagad' },
              ].map(c => (
                <Chip
                  key={c.key}
                  selected={ledgerAccount === c.key}
                  onPress={() => setLedgerAccount(c.key)}
                  style={{ backgroundColor: ledgerAccount === c.key ? theme.colors.primaryContainer : theme.colors.surfaceVariant }}
                  textStyle={{ fontWeight: ledgerAccount === c.key ? 'bold' : 'normal', fontSize: 12 }}
                >
                  {c.label}
                </Chip>
              ))}
            </View>
          </ScrollView>

          {/* Search Bar */}
          <TextInput
            placeholder={isBN ? 'বিবরণ বা ইনভয়েস নং দিয়ে সার্চ...' : 'Search description, invoice...'}
            value={ledgerSearch}
            onChangeText={setLedgerSearch}
            onSubmitEditing={fetchLedger}
            mode="outlined"
            dense
            right={<TextInput.Icon icon="magnify" onPress={fetchLedger} />}
            style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
          />

          {ledgerLoading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : ledgerEntries.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="book-open-outline" size={48} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 8 }}>{isBN ? 'কোনো লেজার এন্ট্রি পাওয়া যায়নি।' : 'No ledger entries found.'}</Text>
            </View>
          ) : (
            <FlatList
              data={ledgerEntries}
              keyExtractor={(item) => String(item.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                const amtNum = parseFloat(item.amount) || 0;
                const isPositive = amtNum >= 0;
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <Surface style={{ borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Chip textStyle={{ fontSize: 10, fontWeight: 'bold' }} style={{ height: 24, backgroundColor: '#f1f5f9' }}>
                          {item.account_display || item.account}
                        </Chip>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{dateStr}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: isPositive ? '#16a34a' : '#dc2626' }}>
                        {isPositive ? '+' : ''}৳ {Math.abs(amtNum).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.colors.onSurface, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  </Surface>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ================= TAB 3: FUND TRANSFERS ================= */}
      {activeTab === 'transfers' && (
        <View style={{ flex: 1, padding: 12 }}>
          {/* Add Transfer Button */}
          <Button
            mode="contained"
            icon="plus"
            onPress={() => setTransferModalVisible(true)}
            style={{ marginBottom: 12, backgroundColor: '#4f46e5', borderRadius: 8 }}
            labelStyle={{ fontWeight: 'bold' }}
          >
            {isBN ? '+ নতুন ফান্ড ট্রান্সফার' : '+ New Fund Transfer'}
          </Button>

          {transfersLoading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : transfers.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bank-transfer" size={48} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 8, textAlign: 'center' }}>
                {isBN ? 'কোনো ফান্ড ট্রান্সফার হিস্ট্রি নেই। ক্যাশ বা ব্যাংকে টাকা সরাতে উপরের বাটনে চাপুন।' : 'No transfer history.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={transfers}
              keyExtractor={(item) => String(item.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                return (
                  <Surface style={{ borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>🕒 {item.transferred_on}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#4f46e5' }}>
                          ৳ {parseFloat(item.amount).toLocaleString()}
                        </Text>
                        <IconButton
                          icon="delete-outline"
                          size={18}
                          iconColor="#dc2626"
                          onPress={() => handleDeleteTransfer(item.id)}
                          style={{ margin: 0, padding: 0 }}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Chip textStyle={{ fontSize: 11, fontWeight: 'bold' }} style={{ backgroundColor: '#fee2e2' }}>
                        {item.from_account_display || item.from_account}
                      </Chip>
                      <MaterialCommunityIcons name="arrow-right-bold" size={18} color="#64748b" />
                      <Chip textStyle={{ fontSize: 11, fontWeight: 'bold' }} style={{ backgroundColor: '#dcfce7' }}>
                        {item.to_account_display || item.to_account}
                      </Chip>
                    </View>

                    {item.note ? (
                      <Text style={{ fontSize: 12, color: '#475569' }}>
                        📝 {item.note}
                      </Text>
                    ) : null}
                  </Surface>
                );
              }}
            />
          )}

          {/* New Transfer Modal */}
          <Modal visible={transferModalVisible} transparent animationType="slide" onRequestClose={() => setTransferModalVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 }}>
              <Surface style={{ borderRadius: 16, padding: 20, backgroundColor: theme.colors.surface }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                    {isBN ? 'নতুন ফান্ড ট্রান্সফার' : 'New Fund Transfer'}
                  </Text>
                  <IconButton icon="close" size={20} onPress={() => setTransferModalVisible(false)} />
                </View>

                {/* From Account */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                  {isBN ? 'উৎস একাউন্ট (যেখান থেকে টাকা যাবে):' : 'From Account:'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {ACCOUNT_CHOICES.map(a => (
                    <Chip
                      key={'from_' + a.key}
                      selected={fromAccount === a.key}
                      onPress={() => setFromAccount(a.key)}
                      style={{ backgroundColor: fromAccount === a.key ? '#fee2e2' : '#f1f5f9' }}
                      textStyle={{ fontSize: 11, fontWeight: fromAccount === a.key ? 'bold' : 'normal' }}
                    >
                      {isBN ? a.labelBN : a.labelEN}
                    </Chip>
                  ))}
                </View>

                {/* To Account */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                  {isBN ? 'গন্তব্য একাউন্ট (যেখানে টাকা জমা হবে):' : 'To Account:'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {ACCOUNT_CHOICES.map(a => (
                    <Chip
                      key={'to_' + a.key}
                      selected={toAccount === a.key}
                      onPress={() => setToAccount(a.key)}
                      style={{ backgroundColor: toAccount === a.key ? '#dcfce7' : '#f1f5f9' }}
                      textStyle={{ fontSize: 11, fontWeight: toAccount === a.key ? 'bold' : 'normal' }}
                    >
                      {isBN ? a.labelBN : a.labelEN}
                    </Chip>
                  ))}
                </View>

                {/* Amount Input */}
                <TextInput
                  label={isBN ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="numeric"
                  mode="outlined"
                  style={{ marginBottom: 12 }}
                />

                {/* Note */}
                <TextInput
                  label={isBN ? 'নোট / বিবরণ (ঐচ্ছিক)' : 'Note (Optional)'}
                  value={transferNote}
                  onChangeText={setTransferNote}
                  mode="outlined"
                  placeholder={isBN ? 'যেমন: ব্যাংক জমা, ক্যাশ ড্রয়ার রিফিল' : 'e.g. Bank deposit, drawer refill'}
                  style={{ marginBottom: 20 }}
                />

                <Button
                  mode="contained"
                  onPress={handleSaveTransfer}
                  loading={transferSubmitting}
                  disabled={transferSubmitting}
                  style={{ backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 4 }}
                  labelStyle={{ fontSize: 15, fontWeight: 'bold' }}
                >
                  {isBN ? 'ট্রান্সফার নিশ্চিত করুন' : 'Confirm Transfer'}
                </Button>
              </Surface>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}
