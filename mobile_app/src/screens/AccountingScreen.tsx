import React, { useState, useEffect } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { Appbar, Text, Card, useTheme, Divider, Chip, ActivityIndicator, Surface } from 'react-native-paper';
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
  bank_balance: string;
  receivables: string;
  payables: string;
};

export default function AccountingScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Date range filter
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');

  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [position, setPosition] = useState<PositionData | null>(null);

  const fetchAccountingData = async () => {
    setError('');
    try {
      let startStr = '';
      let endStr = '';
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (dateFilter === 'today') {
        startStr = `${todayStr}T00:00:00Z`;
        endStr = `${todayStr}T23:59:59Z`;
      } else if (dateFilter === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startStr = `${d.toISOString().split('T')[0]}T00:00:00Z`;
        endStr = `${todayStr}T23:59:59Z`;
      } else if (dateFilter === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startStr = `${d.toISOString().split('T')[0]}T00:00:00Z`;
        endStr = `${todayStr}T23:59:59Z`;
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

  useEffect(() => {
    setLoading(true);
    fetchAccountingData();
  }, [dateFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAccountingData();
  };

  const revenueNum = Number(profit?.revenue || 0);
  const returnsNum = Number(profit?.returns || 0);
  const cogsNum = Number(profit?.cogs || 0);
  const grossProfitNum = Number(profit?.gross_profit || (revenueNum - returnsNum - cogsNum));
  const expensesNum = Number(profit?.expenses || 0);
  const netProfitNum = Number(profit?.net_profit || (grossProfitNum - expensesNum));

  const cashBal = Number(position?.cash_balance || 0);
  const bankBal = Number(position?.bank_balance || 0);
  const receivables = Number(position?.receivables || 0);
  const payables = Number(position?.payables || 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'একাউন্টিং ও নিট প্রফিট' : 'Accounting & P&L'} titleStyle={{ fontWeight: 'bold' }} />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

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
            { key: 'all', label: isBN ? 'সব সময়' : 'All Time' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setDateFilter(f.key as any)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: dateFilter === f.key ? '#2563eb' : theme.colors.surface,
                borderWidth: 1,
                borderColor: dateFilter === f.key ? '#2563eb' : '#cbd5e1',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: dateFilter === f.key ? 'bold' : 'normal',
                  color: dateFilter === f.key ? '#ffffff' : theme.colors.onSurface,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !refreshing ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ marginTop: 12, color: '#64748b' }}>{isBN ? 'হিসাব লোড হচ্ছে...' : 'Loading accounting records...'}</Text>
          </View>
        ) : (
          <>
            {/* 1. Net Profit Card (Hero Banner) */}
            <Surface
              style={{
                borderRadius: 16,
                padding: 18,
                marginBottom: 16,
                backgroundColor: netProfitNum >= 0 ? '#1e3a8a' : '#7f1d1d',
                elevation: 3,
              }}
            >
              <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '600' }}>
                💰 {isBN ? 'আসল নিট লাভ (Net Profit)' : 'Actual Net Profit'}
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginVertical: 6 }}>
                ৳{netProfitNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ color: '#bfdbfe', fontSize: 11 }}>
                {isBN ? 'মোট বিক্রয় - (কেনা খরচ + রিটার্ন + যাবতীয় দোকান খরচ)' : 'Revenue - (COGS + Returns + Operating Expenses)'}
              </Text>
            </Surface>

            {/* 2. Financial Position Grid (Assets & Liabilities) */}
            <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 10, color: theme.colors.onSurface }}>
              💼 {isBN ? 'বর্তমান আর্থিক অবস্থান (Financial Position)' : 'Financial Position'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {/* Cash in Hand */}
              <Card style={{ flex: 1, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', borderWidth: 1, borderColor: '#86efac' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '600' }}>{isBN ? 'নগদ ক্যাশ' : 'Cash in Hand'}</Text>
                  <MaterialCommunityIcons name="cash" size={18} color="#16a34a" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#15803d' }}>
                  ৳{cashBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </Card>

              {/* Bank & MFS */}
              <Card style={{ flex: 1, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderWidth: 1, borderColor: '#93c5fd' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '600' }}>{isBN ? 'ব্যাংক / ওয়ালেট' : 'Bank / MFS'}</Text>
                  <MaterialCommunityIcons name="bank" size={18} color="#2563eb" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1d4ed8' }}>
                  ৳{bankBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </Card>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              {/* Customer Receivables */}
              <Card style={{ flex: 1, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fffbeb', borderWidth: 1, borderColor: '#fde047' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>{isBN ? 'কাস্টমার বাকি' : 'Receivables'}</Text>
                  <MaterialCommunityIcons name="account-clock" size={18} color="#b45309" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#b45309' }}>
                  ৳{receivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </Card>

              {/* Supplier Payables */}
              <Card style={{ flex: 1, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#b91c1c', fontWeight: '600' }}>{isBN ? 'সাপ্লায়ার পাওনা' : 'Payables'}</Text>
                  <MaterialCommunityIcons name="truck-delivery" size={18} color="#b91c1c" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#b91c1c' }}>
                  ৳{payables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </Card>
            </View>

            {/* 3. Profit & Loss Statement (P&L Breakdown) */}
            <Card style={{ padding: 14, backgroundColor: theme.colors.surface, marginBottom: 18, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: theme.colors.onSurface }}>
                📊 {isBN ? 'লাভ-ক্ষতি বিবরণী (P&L Breakdown)' : 'Profit & Loss Statement'}
              </Text>

              {/* Gross Revenue */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                  ➕ {isBN ? 'মোট বিক্রয় (Gross Revenue)' : 'Gross Revenue'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600' }}>
                  ৳{revenueNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Returns */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 13, color: '#dc2626' }}>
                  ➖ {isBN ? 'বিক্রয় রিটার্ন (Sales Returns)' : 'Sales Returns'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#dc2626' }}>
                  (৳{returnsNum.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </Text>
              </View>

              {/* COGS */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 13, color: '#d97706' }}>
                  ➖ {isBN ? 'পণ্যের কেনা খরচ (COGS)' : 'Cost of Goods Sold'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#d97706' }}>
                  (৳{cogsNum.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </Text>
              </View>

              {/* Gross Profit Subtotal */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: isDarkMode ? '#475569' : '#cbd5e1', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', paddingHorizontal: 6, marginTop: 4, borderRadius: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold' }}>
                  {isBN ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2563eb' }}>
                  ৳{grossProfitNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Operating Expenses */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9', marginTop: 4 }}>
                <Text style={{ fontSize: 13, color: '#ea580c' }}>
                  ➖ {isBN ? 'দোকানের অন্যান্য খরচ (Expenses)' : 'Operating Expenses'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#ea580c' }}>
                  (৳{expensesNum.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </Text>
              </View>

              {/* Net Profit Bottom Line */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, backgroundColor: netProfitNum >= 0 ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, marginTop: 8, borderRadius: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: netProfitNum >= 0 ? '#15803d' : '#991b1b' }}>
                  🏆 {isBN ? 'নিট লাভ (Net Profit)' : 'Net Profit'}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: netProfitNum >= 0 ? '#15803d' : '#991b1b' }}>
                  ৳{netProfitNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </Card>

            {/* 4. Payment Method Collections Breakdown */}
            {profit?.payment_methods && Object.keys(profit.payment_methods).length > 0 && (
              <Card style={{ padding: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 10, color: theme.colors.onSurface }}>
                  💳 {isBN ? 'পেমেন্ট মাধ্যম অনুযায়ী মোট আদায়' : 'Collections by Payment Method'}
                </Text>
                {Object.entries(profit.payment_methods).map(([method, val]) => (
                  <View key={method} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f8fafc' }}>
                    <Text style={{ fontSize: 13, textTransform: 'capitalize', color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                      {method.replace('_', ' ')}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.onSurface }}>
                      ৳{Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
