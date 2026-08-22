import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { Text, useTheme, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import Skeleton from '../components/Skeleton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

const getGreeting = (lang: string, userName: string) => {
  const bdTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
  const bdHour = new Date(bdTime).getHours();
  let greetingStr = '';

  if (bdHour >= 5 && bdHour < 12) {
    greetingStr = lang === 'BN' ? 'শুভ সকাল, ' : 'Good morning, ';
  } else if (bdHour >= 12 && bdHour < 16) {
    greetingStr = lang === 'BN' ? 'শুভ দুপুর, ' : 'Good afternoon, ';
  } else if (bdHour >= 16 && bdHour < 18) {
    greetingStr = lang === 'BN' ? 'শুভ বিকেল, ' : 'Good afternoon, ';
  } else if (bdHour >= 18 && bdHour < 20) {
    greetingStr = lang === 'BN' ? 'শুভ সন্ধ্যা, ' : 'Good evening, ';
  } else {
    greetingStr = lang === 'BN' ? 'শুভ রাত্রি, ' : 'Good night, ';
  }
  return greetingStr + userName;
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isDarkMode, language } = usePreferences();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const isBN = language === 'BN';

  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [periodDays, setPeriodDays] = useState(1);
  const [topCardsData, setTopCardsData] = useState<any>(null);

  const [topProductsDays, setTopProductsDays] = useState(30);
  const [topProductsData, setTopProductsData] = useState<any>(null);

  const [trendDays, setTrendDays] = useState(30);
  const [trendData, setTrendData] = useState<any>(null);

  const [showScanner, setShowScanner] = useState(false);

  const loadBaseData = async () => {
    try {
      const res = await api.get('/analytics/dashboard/', { params: { days: 30 } });
      setMetrics(res.data);
      if (!trendData) setTrendData(res.data.sales_trend);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getRangeString = (days: number) => {
    if (days === 1) return 'today';
    if (days === 7) return '7d';
    if (days === 30) return '30d';
    if (days === 365) return 'this_year';
    return 'all_time';
  };

  const loadTopCardsData = async () => {
    try {
      const res = await api.get('/analytics/profit-overview/', { params: { range: getRangeString(periodDays) } });
      setTopCardsData(res.data.summary);
    } catch (e) {
      // ignore
    }
  };

  const loadTopProductsData = async () => {
    try {
      const res = await api.get('/analytics/dashboard/', { params: { days: topProductsDays } });
      setTopProductsData(res.data.top_products);
    } catch (e) {
      // ignore
    }
  };

  const loadTrendData = async () => {
    try {
      const res = await api.get('/analytics/dashboard/', { params: { days: trendDays } });
      setTrendData(res.data.sales_trend);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadTopCardsData();
  }, [periodDays]);

  useEffect(() => {
    loadTopProductsData();
  }, [topProductsDays]);

  useEffect(() => {
    loadTrendData();
  }, [trendDays]);

  useFocusEffect(
    useCallback(() => {
      loadBaseData();
      loadTopCardsData();
      loadTopProductsData();
      loadTrendData();
    }, [periodDays, topProductsDays, trendDays])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBaseData();
    loadTopCardsData();
    loadTopProductsData();
    loadTrendData();
  };

  const chartWidth = Math.min(Dimensions.get('window').width - 48, 440);

  const getChartData = () => {
    if (Array.isArray(trendData) && trendData.length > 0) {
      const step = Math.max(1, Math.floor(trendData.length / 5));
      const labels = trendData.map((item: any, i: number) => {
        if (i % step === 0 || i === trendData.length - 1) {
          const raw = String(item.day || item.date || item.label || '');
          return raw.length >= 10 ? raw.slice(5) : raw;
        }
        return '';
      });
      const raw = trendData.map((item: any) => Number(item.revenue || item.total || item.amount || 0));
      // Chart crashes if all values are zero — ensure at least a tiny baseline
      const data = raw.every((v: number) => v === 0) ? raw.map(() => 0.01) : raw;
      return {
        labels,
        datasets: [{ data: data.length > 0 ? data : [0.01] }],
      };
    }

    if (trendData && Array.isArray(trendData.labels) && trendData.labels.length > 0) {
      const raw = trendData.data.map((d: any) => Number(d) || 0);
      const data = raw.every((v: number) => v === 0) ? raw.map(() => 0.01) : raw;
      return {
        labels: trendData.labels.map((l: string, i: number) => (i % 5 === 0 || i === trendData.labels.length - 1 ? l : '')),
        datasets: [{ data }],
      };
    }

    return {
      labels: ['D-4', 'D-3', 'D-2', 'Yesterday', 'Today'],
      datasets: [{ data: [0.01, 0.01, 0.01, 0.01, Number(topCardsData?.revenue || metrics?.today_sales?.total || 0) || 0.01] }],
    };
  };

  const userName = user?.first_name || user?.email?.split('@')[0] || (isBN ? 'ম্যানেজার' : 'Manager');
  const greetingText = getGreeting(language, userName);

  // Extract metrics
  const salesVal = Number(topCardsData?.revenue ?? metrics?.today_sales?.total ?? metrics?.period?.revenue ?? 0) || 0;
  const profitVal = Number(topCardsData?.gross_profit ?? topCardsData?.profit ?? topCardsData?.net_profit ?? metrics?.period?.gross_profit ?? metrics?.today?.gross_profit ?? 0) || 0;
  // dues: profit-overview returns "total_receivable"; dashboard returns position.receivables
  const duesVal = Number(
    topCardsData?.total_receivable ?? topCardsData?.dues ??
    metrics?.position?.receivables ?? 0
  ) || 0;
  // low stock: dashboard returns low_stock_count directly at top level (not nested under inventory)
  const lowStockCount = Number(metrics?.low_stock_count ?? metrics?.inventory?.low_stock_count ?? 0) || 0;

  const quickActions = [
    {
      titleEn: 'New Sale',
      titleBn: 'নতুন বিক্রয়',
      icon: 'cash-register',
      color: '#2563eb',
      bg: '#eff6ff',
      onPress: () => navigation.navigate('MainTabs', { screen: 'POS' }),
    },
    {
      titleEn: 'Scan Item',
      titleBn: 'বারকোড স্ক্যান',
      icon: 'barcode-scan',
      color: '#7c3aed',
      bg: '#f5f3ff',
      onPress: () => setShowScanner(true),
    },
    {
      titleEn: 'Inward Stock',
      titleBn: 'স্টক ইনওয়ার্ড',
      icon: 'arrow-down-bold-box',
      color: '#16a34a',
      bg: '#f0fdf4',
      onPress: () => navigation.navigate('ProductsScreen', { initialTab: 'purchase' }),
    },
    {
      titleEn: 'Daily Cash',
      titleBn: 'ক্যাশ ক্লোজিং',
      icon: 'cash-check',
      color: '#0891b2',
      bg: '#ecfeff',
      onPress: () => navigation.navigate('SettlementScreen'),
    },
    {
      titleEn: 'Add Expense',
      titleBn: 'খরচ এন্ট্রি',
      icon: 'cash-minus',
      color: '#be185d',
      bg: '#fdf2f8',
      onPress: () => navigation.navigate('ExpensesScreen'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Greeting Banner */}
        <Surface
          style={[
            styles.heroBanner,
            {
              backgroundColor: isDarkMode ? '#1e1b4b' : '#312e81',
            },
          ]}
          elevation={4}
        >
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <MaterialCommunityIcons name="storefront-outline" size={16} color="#a5b4fc" />
                <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '700' }}>
                  {user?.shop_name || 'StockWhisk Store'}
                </Text>
              </View>
              <Text style={styles.heroGreeting}>{greetingText} 👋</Text>
              <Text style={styles.heroSubtext}>
                {isBN ? 'আজকের দোকানের সার্বিক হিসাব ও গতিবিধি' : 'Real-time overview of your store operations'}
              </Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        </Surface>

        {/* 2. Quick Action Bar */}
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          ⚡ {isBN ? 'দ্রুত একশন' : 'Quick Actions'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionScroll}
        >
          {quickActions.map((act, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={act.onPress}
              style={[
                styles.quickActionPill,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: isDarkMode ? act.color + '25' : act.bg },
                ]}
              >
                <MaterialCommunityIcons name={act.icon as any} size={20} color={act.color} />
              </View>
              <Text style={[styles.quickActionText, { color: theme.colors.onSurface }]}>
                {isBN ? act.titleBn : act.titleEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 3. Bento Metric Cards & Filter */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginBottom: 0 }]}>
            📊 {isBN ? 'পারফরম্যান্স মেট্রিক্স' : 'Key Metrics'}
          </Text>

          {/* Period Filter Pills */}
          <View style={styles.filterPillsRow}>
            {[
              { days: 1, label: isBN ? 'আজ' : 'Today' },
              { days: 7, label: isBN ? '৭ দিন' : '7D' },
              { days: 30, label: isBN ? '৩০ দিন' : '30D' },
            ].map(p => (
              <TouchableOpacity
                key={p.days}
                onPress={() => setPeriodDays(p.days)}
                style={[
                  styles.periodPill,
                  periodDays === p.days && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
                  { borderColor: isDarkMode ? '#334155' : '#cbd5e1' },
                ]}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    periodDays === p.days && { color: '#ffffff', fontWeight: 'bold' },
                    { color: periodDays === p.days ? '#ffffff' : isDarkMode ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : (
          <View style={styles.bentoGrid}>
            {/* Sales Card */}
            <Surface
              style={[
                styles.bentoCard,
                { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: '#bfdbfe' },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: '#2563eb' }]}>
                  {isBN ? 'মোট বিক্রয়' : 'Total Revenue'}
                </Text>
                <MaterialCommunityIcons name="trending-up" size={18} color="#2563eb" />
              </View>
              <Text style={[styles.cardValue, { color: '#1d4ed8' }]}>
                ৳{salesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.cardSubtext}>
                {isBN ? 'ইনভয়েস বিক্রয় পরিমাণ' : 'Completed sales'}
              </Text>
            </Surface>

            {/* Profit Card */}
            <Surface
              style={[
                styles.bentoCard,
                { backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', borderColor: '#bbf7d0' },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: '#16a34a' }]}>
                  {isBN ? 'নিট লাভ' : 'Net Profit'}
                </Text>
                <MaterialCommunityIcons name="cash-multiple" size={18} color="#16a34a" />
              </View>
              <Text style={[styles.cardValue, { color: '#15803d' }]}>
                ৳{profitVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.cardSubtext}>
                {isBN ? 'খরচ বাদে মোট লাভ' : 'After COGS & expenses'}
              </Text>
            </Surface>

            {/* Customer Dues Card */}
            <Surface
              style={[
                styles.bentoCard,
                { backgroundColor: isDarkMode ? '#1e293b' : '#fffbeb', borderColor: '#fde047' },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: '#b45309' }]}>
                  {isBN ? 'কাস্টমার বকেয়া' : 'Customer Dues'}
                </Text>
                <MaterialCommunityIcons name="account-clock" size={18} color="#b45309" />
              </View>
              <Text style={[styles.cardValue, { color: '#b45309' }]}>
                ৳{duesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('DuesScreen')}>
                <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: 'bold', marginTop: 4 }}>
                  {isBN ? 'আদায় করুন ➜' : 'Collect ➜'}
                </Text>
              </TouchableOpacity>
            </Surface>

            {/* Low Stock Alert Card */}
            <Surface
              style={[
                styles.bentoCard,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : lowStockCount > 0 ? '#fef2f2' : '#f8fafc',
                  borderColor: lowStockCount > 0 ? '#fca5a5' : '#e2e8f0',
                },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: lowStockCount > 0 ? '#dc2626' : '#64748b' }]}>
                  {isBN ? 'লো-স্টক পণ্য' : 'Low Stock Alert'}
                </Text>
                <MaterialCommunityIcons
                  name="alert-box-outline"
                  size={18}
                  color={lowStockCount > 0 ? '#dc2626' : '#64748b'}
                />
              </View>
              <Text style={[styles.cardValue, { color: lowStockCount > 0 ? '#b91c1c' : theme.colors.onSurface }]}>
                {lowStockCount} {isBN ? 'টি পণ্য' : 'Items'}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}>
                <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: 'bold', marginTop: 4 }}>
                  {isBN ? 'স্টক দেখুন ➜' : 'View Stock ➜'}
                </Text>
              </TouchableOpacity>
            </Surface>
          </View>
        )}

        {/* 4. Sales Trend Chart */}
        <Surface style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
                📈 {isBN ? 'বিক্রয় ট্রেন্ড (Sales Trends)' : 'Sales Trends'}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>
                {isBN ? 'বিগত দিনের বিক্রয়ের চিত্র' : 'Revenue timeline overview'}
              </Text>
            </View>

            <View style={styles.filterPillsRow}>
              {[
                { days: 7, label: isBN ? '৭ দিন' : '7D' },
                { days: 30, label: isBN ? '৩০ দিন' : '30D' },
              ].map(t => (
                <TouchableOpacity
                  key={t.days}
                  onPress={() => setTrendDays(t.days)}
                  style={[
                    styles.periodPill,
                    trendDays === t.days && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
                    { borderColor: isDarkMode ? '#334155' : '#cbd5e1' },
                  ]}
                >
                  <Text
                    style={[
                      styles.periodPillText,
                      trendDays === t.days && { color: '#ffffff', fontWeight: 'bold' },
                      { color: trendDays === t.days ? '#ffffff' : isDarkMode ? '#94a3b8' : '#64748b' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LineChart
            data={getChartData()}
            width={chartWidth}
            height={190}
            yAxisLabel="৳"
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: theme.colors.surface,
              backgroundGradientFrom: theme.colors.surface,
              backgroundGradientTo: theme.colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
              labelColor: (opacity = 1) => (isDarkMode ? `rgba(203, 213, 225, ${opacity})` : `rgba(100, 116, 139, ${opacity})`),
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#4f46e5',
              },
            }}
            bezier
            style={styles.chart}
          />
        </Surface>

        {/* 5. Top Selling Products */}
        <Surface style={[styles.topProductsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              🏆 {isBN ? 'বেস্ট সেলিং পণ্য' : 'Top Selling Products'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Reports' })}>
              <Text style={{ fontSize: 12, color: '#4f46e5', fontWeight: 'bold' }}>
                {isBN ? 'সব দেখুন' : 'View All'}
              </Text>
            </TouchableOpacity>
          </View>

          {topProductsData && topProductsData.length > 0 ? (
            topProductsData.slice(0, 5).map((prod: any, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.productItemRow,
                  { borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9' },
                ]}
              >
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={[styles.productName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {prod.product__name || prod.name || prod.product_name || `Product #${prod.product_id || idx + 1}`}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    {isBN ? 'বিক্রি হয়েছে:' : 'Sold:'} {Number(prod.qty || prod.quantity || prod.total_sold || 0)} {isBN ? 'টি' : 'units'}
                  </Text>
                </View>
                <Text style={styles.productAmount}>
                  ৳{Number(prod.revenue || prod.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#94a3b8', paddingVertical: 16 }}>
              {isBN ? 'কোনো বিক্রয়ের তথ্য নেই' : 'No top products found'}
            </Text>
          )}
        </Surface>

        {/* 6. Recent Sales Feed */}
        <Surface style={[styles.topProductsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              🧾 {isBN ? 'সাম্প্রতিক বিক্রয়' : 'Recent Sales'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SalesScreen')}>
              <Text style={{ fontSize: 12, color: '#4f46e5', fontWeight: 'bold' }}>
                {isBN ? 'সব দেখুন' : 'View All'}
              </Text>
            </TouchableOpacity>
          </View>

          {metrics?.recent_sales && metrics.recent_sales.length > 0 ? (
            metrics.recent_sales.map((sale: any, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.productItemRow,
                  { borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.colors.onSurface }]} numberOfLines={1}>
                    {sale.invoice_no}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    {sale.customer_name}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.productAmount}>
                    ৳{Number(sale.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  {Number(sale.due) > 0 && (
                    <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700' }}>
                      {isBN ? 'বাকি: ' : 'Due: '}৳{Number(sale.due).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#94a3b8', paddingVertical: 16 }}>
              {isBN ? 'আজকের কোনো বিক্রয় নেই' : 'No recent sales'}
            </Text>
          )}
        </Surface>
      </ScrollView>

      {/* Barcode Camera Scanner Modal */}
      <CameraBarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={(code) => {
          setShowScanner(false);
          navigation.navigate('MainTabs', {
            screen: 'POS',
            params: { scannedBarcode: code },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 80,
  },
  heroBanner: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroGreeting: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroSubtext: {
    color: '#c7d2fe',
    fontSize: 11,
    marginTop: 3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 4,
  },
  liveText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  quickActionScroll: {
    paddingRight: 10,
    marginBottom: 18,
    gap: 8,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  periodPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  periodPillText: {
    fontSize: 10,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  bentoCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 2,
  },
  cardSubtext: {
    fontSize: 10,
    color: '#64748b',
  },
  chartCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  chart: {
    borderRadius: 14,
    marginVertical: 4,
    alignSelf: 'center',
  },
  topProductsCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  productItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#4338ca',
    fontSize: 11,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
  },
  productAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
  },
});
