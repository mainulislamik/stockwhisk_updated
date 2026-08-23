import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert, Linking, Platform, Modal } from 'react-native';
import { Text, Card, ActivityIndicator, useTheme, Appbar, Surface, Chip, ProgressBar, Button, Divider } from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

const RANGES = [
  { label: 'Today', labelBN: 'আজকের', days: 1, rangeKey: 'today' },
  { label: 'Yesterday', labelBN: 'গতকালকের', days: 1, rangeKey: 'yesterday' },
  { label: '7d', labelBN: '৭ দিন', days: 7, rangeKey: '7d' },
  { label: '30d', labelBN: '৩০ দিন', days: 30, rangeKey: '30d' },
  { label: 'This Month', labelBN: 'চলতি মাস', days: 30, rangeKey: 'this_month' },
  { label: 'Last Month', labelBN: 'গত মাস', days: 30, rangeKey: 'last_month' },
  { label: 'This Quarter', labelBN: 'চলতি কোয়ার্টার', days: 90, rangeKey: 'this_quarter' },
  { label: 'This Year', labelBN: 'চলতি বছর', days: 365, rangeKey: 'this_year' },
  { label: 'All Time', labelBN: 'সব সময়', days: 3650, rangeKey: 'all_time' },
];

const CATEGORY_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6',
  '#0891b2', '#ec4899', '#f97316', '#64748b', '#059669'
];

const PAYMENT_COLORS: { [key: string]: string } = {
  cash: '#16a34a',
  bkash: '#e11d48',
  nagad: '#ea580c',
  card: '#2563eb',
  bank: '#0891b2',
  other: '#64748b',
};

const REPORT_INFO: { [key: string]: { label: string; labelBN: string; icon: string } } = {
  sales: { label: 'Sales Report', labelBN: 'বিক্রয় রিপোর্ট', icon: 'cart-outline' },
  inventory: { label: 'Inventory / Stock Report', labelBN: 'ইনভেন্টরি ও স্টক রিপোর্ট', icon: 'package-variant-closed' },
  profit_loss: { label: 'Profit & Loss Statement', labelBN: 'লাভ-ক্ষতি বিবরণী (P&L)', icon: 'chart-line' },
  profit: { label: 'Profit Analysis Report', labelBN: 'প্রফিট অ্যানালাইসিস', icon: 'chart-areaspline' },
  customer_due: { label: 'Customer Due Report', labelBN: 'কাস্টমার বকেয়া রিপোর্ট', icon: 'account-cash' },
  employee_sales: { label: 'Employee / Staff Sales', labelBN: 'কর্মীদের বিক্রয় রিপোর্ট', icon: 'account-tie' },
  expense: { label: 'Expense Report', labelBN: 'খরচ রিপোর্ট', icon: 'cash-minus' },
  purchase: { label: 'Purchase / Inward Report', labelBN: 'ক্রয় ও ইনওয়ার্ড রিপোর্ট', icon: 'truck-delivery' },
  taxes: { label: 'Tax & VAT Report', labelBN: 'ট্যাক্স ও ভ্যাট রিপোর্ট', icon: 'receipt' },
  customers: { label: 'Customers Ledger', labelBN: 'গ্রাহক লেজার ও তালিকা', icon: 'account-group' },
};

export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [selectedRange, setSelectedRange] = useState(RANGES[3]); // Default 30d
  const [overview, setOverview] = useState<any>(null);
  const [profitOverview, setProfitOverview] = useState<any>(null);
  const [profitabilityPerf, setProfitabilityPerf] = useState<any>(null);
  const [productPerf, setProductPerf] = useState<any>(null);
  const [profitabilityAnalytics, setProfitabilityAnalytics] = useState<any>(null);
  const [comprehensive, setComprehensive] = useState<any>(null);
  const [reportsList, setReportsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  // Modern Export Selector State
  const [selectedExportReport, setSelectedExportReport] = useState<string>('sales');
  const [selectedExportFormat, setSelectedExportFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');
  const [showReportPicker, setShowReportPicker] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedRange])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ovRes, profitRes, perfRes, ppRes, paRes, compRes, repRes] = await Promise.all([
        api.get('/analytics/sales-overview/').catch(() => ({ data: null })),
        api.get('/analytics/profit-overview/', { params: { range: selectedRange.rangeKey } }).catch(() => ({ data: null })),
        api.get('/analytics/profitability-performance/', { params: { range: selectedRange.rangeKey } }).catch(() => ({ data: null })),
        api.get('/analytics/product-performance-overview/', { params: { range: selectedRange.rangeKey } }).catch(() => ({ data: null })),
        api.get('/analytics/profitability-analytics/', { params: { range: selectedRange.rangeKey } }).catch(() => ({ data: null })),
        api.get('/analytics/dashboard-comprehensive/', { params: { days: selectedRange.days } }).catch(() => ({ data: null })),
        api.get('/reports/').catch(() => ({ data: { reports: [] } })),
      ]);

      if (ovRes.data) setOverview(ovRes.data);
      if (profitRes.data) setProfitOverview(profitRes.data);
      if (perfRes.data) setProfitabilityPerf(perfRes.data);
      if (ppRes.data) setProductPerf(ppRes.data);
      if (paRes.data) setProfitabilityAnalytics(paRes.data);
      if (compRes.data) setComprehensive(compRes.data);
      if (repRes.data?.reports) setReportsList(repRes.data.reports);
    } catch (error) {
      console.log('Error fetching comprehensive reports data', error);
    } finally {
      setLoading(false);
    }
  };

  const chartWidth = Math.min(Dimensions.get('window').width, 500) - 48;

  const handleDownloadReport = async (reportType: string, fmt: 'csv' | 'excel' | 'pdf') => {
    setDownloadingReport(`${reportType}-${fmt}`);
    try {
      let token = '';
      if (Platform.OS === 'web') {
        token = localStorage.getItem('access_token') || '';
      } else {
        token = (await SecureStore.getItemAsync('access_token')) || '';
      }
      const baseUrl = api.defaults.baseURL || 'https://stockwhisk.com/api';
      const exportUrl = `${baseUrl}/reports/export/?type=${reportType}&export_format=${fmt}&token=${token}`;
      await Linking.openURL(exportUrl);
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'রিপোর্ট ডাউনলোড করতে সমস্যা হয়েছে।' : 'Could not download report.');
    } finally {
      setDownloadingReport(null);
    }
  };

  const renderChangeBadge = (val: number | null | undefined, isPoints = false, goodWhenUp = true) => {
    if (val === null || val === undefined) {
      return (
        <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          {isBN ? 'পূর্ববর্তী তথ্য নেই' : 'No prev data'}
        </Text>
      );
    }
    const up = val > 0;
    const down = val < 0;
    const isGood = (up && goodWhenUp) || (down && !goodWhenUp);
    const color = val === 0 ? '#64748b' : (isGood ? '#16a34a' : '#dc2626');
    const arrow = up ? '↑' : (down ? '↓' : '→');
    const displayVal = isPoints ? `${Math.abs(val).toFixed(2)} pts` : `${Math.abs(val).toFixed(1)}%`;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: 'bold', color, marginRight: 3 }}>
          {arrow} {displayVal}
        </Text>
        <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          {isBN ? 'গত সময়ের তুলনায়' : 'vs prev'}
        </Text>
      </View>
    );
  };

  const renderChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
      {RANGES.map((range, index) => {
        const isSelected = selectedRange.rangeKey === range.rangeKey;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => setSelectedRange(range)}
            style={[
              styles.chip,
              { backgroundColor: isSelected ? '#2563eb' : theme.colors.surface, borderColor: isSelected ? '#2563eb' : (isDarkMode ? '#334155' : '#e2e8f0') },
            ]}
          >
            <Text style={{ color: isSelected ? '#fff' : theme.colors.onSurface, fontWeight: isSelected ? 'bold' : '600', fontSize: 13 }}>
              {isBN ? range.labelBN : range.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const profitTrend = profitOverview?.trend || [];
  const topProfitable = profitabilityPerf?.top_profitable_products || [];
  const topLoss = profitabilityPerf?.top_loss_products || [];
  const lowestMargin = profitabilityPerf?.lowest_margin_products || [];
  const mostSold = productPerf?.most_sold_products || comprehensive?.top_products || [];
  const lowStock = productPerf?.low_stock_products || comprehensive?.low_stock || [];
  const outOfStock = productPerf?.out_of_stock_products || comprehensive?.out_of_stock || [];
  const paymentMetrics = profitabilityAnalytics?.payment_metrics;
  const salesTrend = profitabilityAnalytics?.sales_trend || [];
  const topCustomers = comprehensive?.top_customers || [];
  const paymentMethods = comprehensive?.payment_methods || [];
  const salesByCategory = comprehensive?.sales_by_category || [];
  const topReturns = comprehensive?.top_returns || [];
  const recentTransactions = comprehensive?.recent_transactions || [];

  // Build Pie Data for Categories
  const categoryPieData = salesByCategory.slice(0, 6).map((c: any, i: number) => ({
    name: c.product__category__name ? (c.product__category__name.length > 10 ? c.product__category__name.slice(0, 9) + '…' : c.product__category__name) : (isBN ? 'অন্যান্য' : 'Other'),
    population: Math.max(0, Number(c.revenue || 0)),
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    legendFontColor: isDarkMode ? '#e2e8f0' : '#334155',
    legendFontSize: 11,
  })).filter((d: any) => d.population > 0);

  // Build Pie Data for Payment Methods
  const paymentPieData = paymentMethods.map((pm: any) => {
    const key = (pm.method || pm.payment_method || 'other').toLowerCase();
    return {
      name: key.toUpperCase(),
      population: Math.max(0, Number(pm.total || 0)),
      color: PAYMENT_COLORS[key] || '#64748b',
      legendFontColor: isDarkMode ? '#e2e8f0' : '#334155',
      legendFontSize: 11,
    };
  }).filter((d: any) => d.population > 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'রিপোর্ট ও অ্যানালিটিক্স' : 'Reports & Analytics'} titleStyle={{ fontWeight: 'bold', fontSize: 18 }} />
      </Appbar.Header>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {renderChips()}

        {loading && <ActivityIndicator style={{ marginVertical: 12 }} color="#2563eb" />}

        {/* 1. Sales Overview Header KPI Cards */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="view-dashboard-outline" size={20} color="#2563eb" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'বিক্রয় ওভারভিউ (Sales Overview)' : 'Sales Overview'}
          </Text>
        </View>
        <View style={styles.grid}>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="cash-multiple" size={16} color="#2563eb" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'মোট সেলস' : 'Total Sales'}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#2563eb' }]}>৳{Number(overview?.total_sales || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="receipt" size={16} color="#0891b2" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'মোট অর্ডার' : 'Total Orders'}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#0891b2' }]}>{Number(overview?.total_orders || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="calendar-month" size={16} color="#16a34a" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'চলতি মাসের সেলস' : 'This Month Sales'}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#16a34a' }]}>৳{Number(overview?.this_month_sales || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="calendar-check" size={16} color="#059669" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'চলতি মাসের অর্ডার' : 'This Month Orders'}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#059669' }]}>{Number(overview?.this_month_orders || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="cash-clock" size={16} color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'আজকের সেলস' : "Today's Sales"}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#f59e0b' }]}>৳{Number(overview?.today_sales || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="shopping" size={16} color="#d97706" style={{ marginRight: 4 }} />
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'আজকের অর্ডার' : "Today's Orders"}</Text>
            </View>
            <Text style={[styles.cardValue, { color: '#d97706' }]}>{Number(overview?.today_orders || 0).toLocaleString()}</Text>
          </Surface>
        </View>

        {/* 2. Profit Overview with Comparative Change Badges */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="chart-areaspline" size={20} color="#16a34a" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'প্রফিট ও মার্জিন বিশ্লেষণ' : 'Profit & Margin Analytics'}
          </Text>
        </View>
        <View style={styles.grid}>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'গ্রস প্রফিট' : 'Gross Profit'}</Text>
            <Text style={[styles.cardValue, { color: '#16a34a' }]}>৳{Number(profitOverview?.summary?.gross_profit || 0).toLocaleString()}</Text>
            {renderChangeBadge(profitOverview?.comparison?.gross_profit_change)}
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'মোট ক্রয় খরচ' : 'Total Cost'}</Text>
            <Text style={[styles.cardValue, { color: '#dc2626' }]}>৳{Number(profitOverview?.summary?.total_cost || 0).toLocaleString()}</Text>
            {renderChangeBadge(profitOverview?.comparison?.total_cost_change, false, false)}
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'প্রফিট মার্জিন' : 'Profit Margin'}</Text>
            <Text style={[styles.cardValue, { color: '#2563eb' }]}>
              {profitOverview?.summary?.profit_margin ? Number(profitOverview.summary.profit_margin).toFixed(2) : '0.00'}%
            </Text>
            {renderChangeBadge(profitOverview?.comparison?.profit_margin_change, true)}
          </Surface>
          <Surface style={[styles.cardHalf, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>{isBN ? 'গড় প্রফিট / অর্ডার' : 'Avg. Profit / Order'}</Text>
            <Text style={[styles.cardValue, { color: '#0891b2' }]}>৳{Number(profitOverview?.summary?.average_profit_per_order || 0).toLocaleString()}</Text>
            {renderChangeBadge(profitOverview?.comparison?.average_profit_per_order_change)}
          </Surface>
        </View>

        {/* 3. Profit Trend Chart (Revenue, Cost, Profit) */}
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
              📈 {isBN ? 'রেভিনিউ, খরচ ও প্রফিট ধারা' : 'Revenue, Cost & Profit Trend'}
            </Text>
            {profitTrend.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#2563eb', marginRight: 4, borderRadius: 5 }} />
                    <Text style={{ fontSize: 11 }}>{isBN ? 'রেভিনিউ' : 'Revenue'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#dc2626', marginRight: 4, borderRadius: 5 }} />
                    <Text style={{ fontSize: 11 }}>{isBN ? 'খরচ' : 'Cost'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#16a34a', marginRight: 4, borderRadius: 5 }} />
                    <Text style={{ fontSize: 11 }}>{isBN ? 'প্রফিট' : 'Profit'}</Text>
                  </View>
                </View>
                <LineChart
                  data={{
                    labels: (() => {
                      if (profitTrend.length <= 1) return profitTrend.length === 1 ? [new Date(profitTrend[0].date).getDate().toString(), ''] : [''];
                      const step = Math.max(1, Math.floor(profitTrend.length / 5));
                      return profitTrend.map((d: any, i: number) => {
                        if (i % step === 0 || i === profitTrend.length - 1) {
                          const dt = new Date(d.date);
                          return isNaN(dt.getDate()) ? '' : `${dt.getMonth() + 1}/${dt.getDate()}`;
                        }
                        return '';
                      });
                    })(),
                    datasets: [
                      {
                        data: profitTrend.length === 1
                          ? [Number(profitTrend[0].revenue) || 0, Number(profitTrend[0].revenue) || 0]
                          : profitTrend.map((d: any) => Number(d.revenue) || 0),
                        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                      },
                      {
                        data: profitTrend.length === 1
                          ? [Number(profitTrend[0].cost) || 0, Number(profitTrend[0].cost) || 0]
                          : profitTrend.map((d: any) => Number(d.cost) || 0),
                        color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
                      },
                      {
                        data: profitTrend.length === 1
                          ? [Number(profitTrend[0].profit) || 0, Number(profitTrend[0].profit) || 0]
                          : profitTrend.map((d: any) => Number(d.profit) || 0),
                        color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
                      },
                    ],
                  }}
                  width={chartWidth}
                  height={220}
                  yAxisLabel="৳"
                  withDots={true}
                  withShadow={false}
                  chartConfig={{
                    backgroundColor: theme.colors.surface,
                    backgroundGradientFrom: theme.colors.surface,
                    backgroundGradientTo: theme.colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    propsForDots: { r: '3', strokeWidth: '1', stroke: theme.colors.surface },
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 12 }}
                />
              </>
            ) : (
              <Text style={{ textAlign: 'center', marginVertical: 20, color: '#64748b' }}>{isBN ? 'কোনো তথ্য নেই' : 'No data available'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 4. Profit Margin % Trend Chart */}
        {profitTrend.length > 0 && (
          <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
                📊 {isBN ? 'প্রফিট মার্জিন শতকরা ধারা (%)' : 'Profit Margin Trend (%)'}
              </Text>
              <LineChart
                data={{
                  labels: (() => {
                    const step = Math.max(1, Math.floor(profitTrend.length / 5));
                    return profitTrend.map((d: any, i: number) => {
                      if (i % step === 0 || i === profitTrend.length - 1) {
                        const dt = new Date(d.date);
                        return isNaN(dt.getDate()) ? '' : `${dt.getMonth() + 1}/${dt.getDate()}`;
                      }
                      return '';
                    });
                  })(),
                  datasets: [
                    {
                      data: profitTrend.map((d: any) => Number(d.margin) || 0),
                      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    },
                  ],
                }}
                width={chartWidth}
                height={180}
                yAxisSuffix="%"
                withDots={true}
                withShadow={false}
                chartConfig={{
                  backgroundColor: theme.colors.surface,
                  backgroundGradientFrom: theme.colors.surface,
                  backgroundGradientTo: theme.colors.surface,
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  propsForDots: { r: '3', strokeWidth: '1', stroke: theme.colors.surface },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 12 }}
              />
            </Card.Content>
          </Card>
        )}

        {/* 5. Payment Ratios Cards */}
        {paymentMetrics && (
          <>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="credit-card-check-outline" size={20} color="#059669" style={{ marginRight: 6 }} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {isBN ? 'পেমেন্ট ও অর্ডার অনুপাত (Payment Ratios)' : 'Payment & Order Ratios'}
              </Text>
            </View>
            <View style={styles.grid}>
              <Surface style={[styles.cardThird, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: 'bold' }}>{isBN ? 'সম্পূর্ণ পরিশোধ' : 'Fully Paid'}</Text>
                <Text style={[styles.cardValue, { color: '#16a34a', fontSize: 20 }]}>
                  {paymentMetrics.fulfill_payment_ratio?.percentage || 0}%
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  {paymentMetrics.fulfill_payment_ratio?.fulfilled_count || 0} / {paymentMetrics.fulfill_payment_ratio?.total_count || 0} {isBN ? 'অর্ডার' : 'orders'}
                </Text>
              </Surface>
              <Surface style={[styles.cardThird, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <Text style={{ fontSize: 11, color: '#d97706', fontWeight: 'bold' }}>{isBN ? 'বকেয়া / পেন্ডিং' : 'Pending Due'}</Text>
                <Text style={[styles.cardValue, { color: '#d97706', fontSize: 20 }]}>
                  {paymentMetrics.pending_payment_ratio?.percentage || 0}%
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  {paymentMetrics.pending_payment_ratio?.pending_count || 0} / {paymentMetrics.pending_payment_ratio?.total_count || 0} {isBN ? 'অর্ডার' : 'orders'}
                </Text>
              </Surface>
              <Surface style={[styles.cardThird, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>{isBN ? 'বাতিল' : 'Cancelled'}</Text>
                <Text style={[styles.cardValue, { color: '#dc2626', fontSize: 20 }]}>
                  {paymentMetrics.cancellation_ratio?.percentage || 0}%
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  {paymentMetrics.cancellation_ratio?.cancelled_count || 0} / {paymentMetrics.cancellation_ratio?.total_count || 0} {isBN ? 'অর্ডার' : 'orders'}
                </Text>
              </Surface>
            </View>
          </>
        )}

        {/* 6. Top Profitable Products */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#16a34a" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'সর্বোচ্চ লাভজনক পণ্য (Top Profitable)' : 'Top Profitable Products'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            {topProfitable.length > 0 ? (
              topProfitable.slice(0, 5).map((p: any, i: number) => (
                <View key={i} style={styles.listItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 13 }}>#{i + 1} {p.product_name}</Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {isBN ? 'বিক্রিত' : 'Sold'}: {p.units_sold} | {isBN ? 'মার্জিন' : 'Margin'}: <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>{Number(p.margin || 0).toFixed(1)}%</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 14 }}>+৳{Number(p.profit || 0).toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>{isBN ? 'রেভিনিউ' : 'Rev'}: ৳{Number(p.revenue || 0).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: '#64748b', marginVertical: 10 }}>{isBN ? 'কোনো ডাটা নেই' : 'No data available'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 7. Top Loss Products (ক্ষতিগ্রস্ত পণ্য) */}
        {topLoss.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={20} color="#dc2626" style={{ marginRight: 6 }} />
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: '#dc2626' }]}>
                {isBN ? 'ক্ষতিগ্রস্ত পণ্য (Top Loss Products)' : 'Top Loss Products'}
              </Text>
            </View>
            <Card style={[styles.fullCard, { backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderColor: '#fca5a5', borderWidth: 1 }]}>
              <Card.Content>
                {topLoss.slice(0, 5).map((p: any, i: number) => (
                  <View key={i} style={[styles.listItem, { borderBottomColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#dc2626' }}>#{i + 1} {p.product_name}</Text>
                      <Text style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
                        {isBN ? 'বিক্রিত' : 'Sold'}: {p.units_sold} | {isBN ? 'মার্জিন' : 'Margin'}: {Number(p.margin || 0).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: 'bold', color: '#dc2626', fontSize: 14 }}>-৳{Number(p.loss || -p.profit || 0).toLocaleString()}</Text>
                      <Text style={{ fontSize: 10, color: '#991b1b' }}>{isBN ? 'খরচ' : 'Cost'}: ৳{Number(p.cost || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}

        {/* 8. Lowest Margin Products */}
        {lowestMargin.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={20} color="#d97706" style={{ marginRight: 6 }} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {isBN ? 'সর্বনিম্ন মার্জিনের পণ্য (Lowest Margin)' : 'Lowest Margin Products'}
              </Text>
            </View>
            <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                {lowestMargin.slice(0, 5).map((p: any, i: number) => (
                  <View key={i} style={styles.listItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13 }}>#{i + 1} {p.product_name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {isBN ? 'বিক্রিত' : 'Sold'}: {p.units_sold} | {isBN ? 'প্রফিট' : 'Profit'}: ৳{Number(p.profit || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Chip textStyle={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }} style={{ backgroundColor: '#d97706', height: 24 }}>
                        {Number(p.margin || 0).toFixed(2)}%
                      </Chip>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}

        {/* 9. Sales by Category (PieChart) */}
        {categoryPieData.length > 0 && (
          <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
                🏷️ {isBN ? 'ক্যাটাগরি ভিত্তিক বিক্রয়' : 'Sales by Category'}
              </Text>
              <PieChart
                data={categoryPieData}
                width={chartWidth}
                height={190}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="10"
                absolute
              />
            </Card.Content>
          </Card>
        )}

        {/* 10. Payment Methods Breakdown (PieChart) */}
        {paymentPieData.length > 0 && (
          <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
                💳 {isBN ? 'পেমেন্ট মেথড ডিস্ট্রিবিউশন' : 'Payment Methods Breakdown'}
              </Text>
              <PieChart
                data={paymentPieData}
                width={chartWidth}
                height={190}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="10"
                absolute
              />
            </Card.Content>
          </Card>
        )}

        {/* 11. Most Sold Products */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="star-outline" size={20} color="#2563eb" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'শীর্ষ বিক্রিত পণ্য (Most Sold)' : 'Most Sold Products'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            {mostSold.length > 0 ? (
              mostSold.slice(0, 5).map((p: any, i: number) => (
                <View key={i} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>#{i + 1} {p.product_name || p.name || p.product__name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.secondary }}>
                      {isBN ? 'পরিমাণ' : 'Qty'}: {p.units_sold || p.qty || 0}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>৳{Number(p.revenue || 0).toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: '#64748b' }}>{isBN ? 'কোনো ডাটা নেই' : 'No data'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 12. Top Customers */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="account-star-outline" size={20} color="#8b5cf6" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'শীর্ষ গ্রাহক (Top Customers)' : 'Top Customers'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            {topCustomers.length > 0 ? (
              topCustomers.slice(0, 5).map((c: any, i: number) => (
                <View key={i} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{c.customer__name || c.name || `Customer #${i + 1}`}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.secondary }}>{isBN ? 'অর্ডার' : 'Orders'}: {c.order_count || c.orders || 0}</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: '#8b5cf6' }}>৳{Number(c.total_spent || 0).toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: '#64748b' }}>{isBN ? 'কোনো ডাটা নেই' : 'No data'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 13. Low Stock & Out of Stock Alerts */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="alert-outline" size={20} color="#ea580c" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'ইনভেন্টরি লো-স্টক অ্যালার্ট' : 'Inventory Low Stock Alerts'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            {outOfStock.length > 0 || lowStock.length > 0 ? (
              <>
                {outOfStock.slice(0, 5).map((s: any, i: number) => (
                  <View key={`out-${i}`} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold' }}>{s.name || s.product_name}</Text>
                      <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>
                        🚫 {isBN ? 'স্টক আউট (নিষ্ক্রিয়)' : 'Out of Stock (Deactive)'}
                      </Text>
                    </View>
                    <Chip textStyle={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }} style={{ backgroundColor: '#dc2626', height: 24 }}>
                      0 {isBN ? 'পিস' : 'pcs'}
                    </Chip>
                  </View>
                ))}
                {lowStock.slice(0, 5).map((s: any, i: number) => {
                  const min = Number(s.minimum_stock || s.reorder_level || 5);
                  const curr = Number(s.current_stock || 0);
                  const ratio = Math.min(1, Math.max(0.1, curr / (min || 1)));
                  return (
                    <View key={`low-${i}`} style={[styles.listItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: 'bold', flex: 1 }}>{s.name || s.product_name}</Text>
                        <Text style={{ fontWeight: 'bold', color: '#d97706' }}>{curr} / {min}</Text>
                      </View>
                      <ProgressBar progress={ratio} color="#d97706" style={{ height: 6, borderRadius: 3 }} />
                      <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        {isBN ? 'রিঅর্ডার প্রয়োজন (ঘাটতি রয়েছে)' : 'Needs reorder (Deficit)'}
                      </Text>
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={{ textAlign: 'center', color: '#16a34a' }}>✅ {isBN ? 'সব ঠিক আছে (ইনভেন্টরি পর্যাপ্ত)' : 'Inventory Healthy'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 14. High Return Products */}
        {topReturns.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="keyboard-return" size={20} color="#dc2626" style={{ marginRight: 6 }} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {isBN ? 'শীর্ষ রিটার্ন পণ্য' : 'High Return Products'}
              </Text>
            </View>
            <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                {topReturns.map((r: any, i: number) => (
                  <View key={i} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold' }}>{r.sale_item__product__name}</Text>
                      <Text style={{ fontSize: 12, color: '#dc2626' }}>{isBN ? 'রিটার্ন পরিমাণ' : 'Return Qty'}: {r.qty}</Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>৳{Number(r.refund_amount || 0).toLocaleString()}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}

        {/* 15. Recent Transactions */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="history" size={20} color="#2563eb" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            {recentTransactions.length > 0 ? (
              recentTransactions.slice(0, 6).map((t: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={styles.listItem}
                  onPress={() => {
                    if (t.id) {
                      navigation.navigate('Sales', { invoiceId: t.id });
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{t.invoice_number}</Text>
                    <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      {t.customer_name || 'Walk-in'} • {t.payment_method?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>৳{Number(t.total || 0).toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>{new Date(t.created_at).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: '#64748b' }}>{isBN ? 'কোনো লেনদেন নেই' : 'No transactions'}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 16. Modernized Report Exports */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="file-download-outline" size={20} color="#0891b2" style={{ marginRight: 6 }} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {isBN ? 'রিপোর্ট ডাউনলোড ও এক্সপোর্ট (Export Reports)' : 'Download & Export Reports'}
          </Text>
        </View>
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 14 }}>
              {isBN ? 'যেকোনো রিপোর্ট নির্বাচন করে Excel, PDF বা CSV ফরম্যাটে সরাসরি ডাউনলোড ও শেয়ার করুন:' : 'Select any report and export directly in Excel, PDF or CSV format:'}
            </Text>

            {/* 1. Report Selector Dropdown Box */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 6 }}>
              {isBN ? '১. রিপোর্টের ধরণ নির্বাচন করুন (Report Type)' : '1. Select Report Type'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowReportPicker(true)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#2563eb',
                backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialCommunityIcons
                  name={(REPORT_INFO[selectedExportReport]?.icon as any) || 'file-document-outline'}
                  size={22}
                  color="#2563eb"
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
                    {isBN
                      ? (REPORT_INFO[selectedExportReport]?.labelBN || selectedExportReport.replace(/_/g, ' ').toUpperCase())
                      : (REPORT_INFO[selectedExportReport]?.label || selectedExportReport.replace(/_/g, ' ').toUpperCase())}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {selectedExportReport.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#2563eb" />
            </TouchableOpacity>

            {/* 2. Format Selection Tabs */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 6 }}>
              {isBN ? '২. এক্সপোর্ট ফরম্যাট (Export Format)' : '2. Select Export Format'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'excel', label: 'Excel (.xlsx)', icon: 'file-excel', color: '#16a34a', bg: isDarkMode ? '#064e3b' : '#dcfce7' },
                { key: 'pdf', label: 'PDF Document', icon: 'file-pdf-box', color: '#dc2626', bg: isDarkMode ? '#450a0a' : '#fee2e2' },
                { key: 'csv', label: 'CSV Data', icon: 'file-delimited', color: '#2563eb', bg: isDarkMode ? '#1e3a8a' : '#dbeafe' },
              ].map(fmt => {
                const isSelected = selectedExportFormat === fmt.key;
                return (
                  <TouchableOpacity
                    key={fmt.key}
                    onPress={() => setSelectedExportFormat(fmt.key as any)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: isSelected ? fmt.color : (isDarkMode ? '#334155' : '#e2e8f0'),
                      backgroundColor: isSelected ? fmt.bg : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    }}
                  >
                    <MaterialCommunityIcons name={fmt.icon as any} size={20} color={isSelected ? fmt.color : '#64748b'} style={{ marginBottom: 3 }} />
                    <Text style={{ fontSize: 11, fontWeight: isSelected ? 'bold' : '600', color: isSelected ? fmt.color : (isDarkMode ? '#94a3b8' : '#64748b') }}>
                      {fmt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Main Download Button */}
            <Button
              mode="contained"
              buttonColor={selectedExportFormat === 'excel' ? '#16a34a' : (selectedExportFormat === 'pdf' ? '#dc2626' : '#2563eb')}
              icon="download"
              loading={!!downloadingReport}
              disabled={!!downloadingReport}
              onPress={() => handleDownloadReport(selectedExportReport, selectedExportFormat)}
              style={{ borderRadius: 12, paddingVertical: 4 }}
              contentStyle={{ height: 48 }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#fff' }}>
                {isBN ? '📥 রিপোর্ট ডাউনলোড করুন' : '📥 Download & Export Report'}
              </Text>
            </Button>
          </Card.Content>
        </Card>

      </ScrollView>

      {/* Report Type Selector Modal */}
      <Modal visible={showReportPicker} transparent animationType="fade" onRequestClose={() => setShowReportPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowReportPicker(false)}>
          <Card style={{ width: '100%', maxWidth: 420, maxHeight: '80%', padding: 16, backgroundColor: theme.colors.surface }} onPress={e => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2563eb' }}>
                {isBN ? 'রিপোর্ট নির্বাচন করুন' : 'Select Report Type'}
              </Text>
              <TouchableOpacity onPress={() => setShowReportPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {(reportsList.length > 0 ? reportsList : ['sales', 'inventory', 'profit_loss', 'customer_due', 'employee_sales', 'expense', 'purchase', 'taxes', 'customers']).map(rep => {
                const info = REPORT_INFO[rep] || { label: rep.replace(/_/g, ' ').toUpperCase(), labelBN: rep.replace(/_/g, ' '), icon: 'file-document-outline' };
                const isSelected = selectedExportReport === rep;
                return (
                  <TouchableOpacity
                    key={rep}
                    onPress={() => {
                      setSelectedExportReport(rep);
                      setShowReportPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: isSelected ? '#2563eb' : (isDarkMode ? '#334155' : '#e2e8f0'),
                      backgroundColor: isSelected ? (isDarkMode ? '#1e293b' : '#eff6ff') : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name={info.icon as any} size={22} color={isSelected ? '#2563eb' : '#64748b'} style={{ marginRight: 10 }} />
                      <View>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isSelected ? '#2563eb' : theme.colors.onSurface }}>
                          {isBN ? info.labelBN : info.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>
                          {rep.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  cardHalf: {
    width: '48.5%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  cardThird: {
    width: '31.5%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  fullCard: {
    marginBottom: 14,
    borderRadius: 14,
    elevation: 1,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.1)',
    alignItems: 'center',
  },
});
