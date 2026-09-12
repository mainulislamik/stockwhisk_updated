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
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';
import { AppColors } from '../constants/theme';

const getGreeting = (lang: string, userName: string) => {
  const greetingStr = lang === 'BN' ? 'স্বাগতম, ' : 'Welcome, ';
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

  const [showScanner, setShowScanner] = useState(false);

  const loadBaseData = async () => {
    try {
      const res = await api.get('/analytics/dashboard/', { params: { days: 30 } });
      setMetrics(res.data);
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

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadTopCardsData();
  }, [periodDays]);

  useFocusEffect(
    useCallback(() => {
      loadBaseData();
      loadTopCardsData();
    }, [periodDays])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBaseData(),
        loadTopCardsData(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const userName = user?.first_name || user?.email?.split('@')[0] || (isBN ? 'ম্যানেজার' : 'Manager');
  const greetingText = getGreeting(language, userName);

  // Extract metrics
  const salesVal = Number(topCardsData?.revenue ?? metrics?.today_sales?.total ?? metrics?.period?.revenue ?? 0) || 0;
  const profitVal = Number(topCardsData?.gross_profit ?? topCardsData?.profit ?? topCardsData?.net_profit ?? metrics?.period?.gross_profit ?? metrics?.today?.gross_profit ?? 0) || 0;
  const duesVal = Number(
    topCardsData?.total_receivable ?? topCardsData?.dues ??
    metrics?.position?.receivables ?? 0
  ) || 0;
  const lowStockCount = Number(metrics?.low_stock_count ?? metrics?.inventory?.low_stock_count ?? 0) || 0;
  const outOfStockCount = Number(metrics?.out_of_stock_count ?? 0) || 0;
  const hasStockAlert = outOfStockCount > 0 || lowStockCount > 0;

  const brandColor = isDarkMode ? AppColors.primaryAccent : AppColors.primary;
  const brandBg = isDarkMode ? AppColors.primaryBgDark : AppColors.primaryBgLight;

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

        {/* 2. 📊 Key Metrics & Filter */}
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
                  periodDays === p.days && { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
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
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : (
          <View style={styles.bentoGrid}>
            {/* Sales Card */}
            <Surface
              style={[
                styles.bentoCard,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#eef2ff',
                  borderColor: isDarkMode ? '#3730a3' : '#c7d2fe',
                },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: isDarkMode ? '#a5b4fc' : AppColors.primary }]}>
                  {isBN ? 'মোট বিক্রয়' : 'Total Revenue'}
                </Text>
                <MaterialCommunityIcons name="trending-up" size={18} color={isDarkMode ? '#a5b4fc' : AppColors.primary} />
              </View>
              <Text style={[styles.cardValue, { color: isDarkMode ? '#ffffff' : AppColors.primaryDark }]}>
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
                {
                  backgroundColor: isDarkMode ? '#052e16' : '#f0fdf4',
                  borderColor: isDarkMode ? '#065f46' : '#bbf7d0',
                },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: isDarkMode ? '#86efac' : AppColors.success }]}>
                  {isBN ? 'নিট লাভ' : 'Net Profit'}
                </Text>
                <MaterialCommunityIcons name="cash-multiple" size={18} color={isDarkMode ? '#86efac' : AppColors.success} />
              </View>
              <Text style={[styles.cardValue, { color: isDarkMode ? '#ffffff' : AppColors.successText }]}>
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
                {
                  backgroundColor: isDarkMode ? '#451a03' : '#fffbeb',
                  borderColor: isDarkMode ? '#78350f' : '#fde047',
                },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: isDarkMode ? '#fde68a' : AppColors.warningText }]}>
                  {isBN ? 'কাস্টমার বকেয়া' : 'Customer Dues'}
                </Text>
                <MaterialCommunityIcons name="account-clock" size={18} color={isDarkMode ? '#fde68a' : AppColors.warningText} />
              </View>
              <Text style={[styles.cardValue, { color: isDarkMode ? '#ffffff' : AppColors.warningText }]}>
                ৳{duesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('DuesScreen')}>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#818cf8' : AppColors.primary, fontWeight: 'bold', marginTop: 4 }}>
                  {isBN ? 'আদায় করুন ➜' : 'Collect ➜'}
                </Text>
              </TouchableOpacity>
            </Surface>

            {/* Low Stock Alert Card */}
            <Surface
              style={[
                styles.bentoCard,
                {
                  backgroundColor: isDarkMode
                    ? (hasStockAlert ? '#450a0a' : '#1e293b')
                    : (hasStockAlert ? '#fef2f2' : '#f8fafc'),
                  borderColor: hasStockAlert
                    ? (isDarkMode ? '#7f1d1d' : '#fca5a5')
                    : (isDarkMode ? '#334155' : '#e2e8f0'),
                },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardLabel, { color: hasStockAlert ? AppColors.danger : '#64748b' }]}>
                  {isBN ? 'স্টক অ্যালার্ট' : 'Stock Alert'}
                </Text>
                <MaterialCommunityIcons
                  name="alert-box-outline"
                  size={18}
                  color={hasStockAlert ? AppColors.danger : '#64748b'}
                />
              </View>
              <Text style={[styles.cardValue, { color: hasStockAlert ? (isDarkMode ? '#fca5a5' : AppColors.dangerText) : theme.colors.onSurface, fontSize: 20 }]}>
                {outOfStockCount} / {lowStockCount}
              </Text>
              <Text style={{ fontSize: 10, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 2 }}>
                {isBN ? ('আউট ' + outOfStockCount + ' · লো ' + lowStockCount) : ('Out ' + outOfStockCount + ' · Low ' + lowStockCount)}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#818cf8' : AppColors.primary, fontWeight: 'bold', marginTop: 2 }}>
                  {isBN ? 'স্টক দেখুন ➜' : 'View Stock ➜'}
                </Text>
              </TouchableOpacity>
            </Surface>
          </View>
        )}

        {/* 3. ⚡ দ্রুত অ্যাক্সেস (Quick Access Grid) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginBottom: 0 }]}>
            ⚡ {isBN ? 'দ্রুত অ্যাক্সেস' : 'Quick Access'}
          </Text>
          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            {isBN ? 'সব কাজ এক জায়গায়' : 'All actions'}
          </Text>
        </View>

        <View style={styles.qaGrid}>
          {[
            { icon: 'cash-register',         titleBn: 'নতুন বিক্রয় (POS)',    titleEn: 'New Sale (POS)',     subBn: 'কার্টে পণ্য যোগ',        subEn: 'Add to cart',          go: () => navigation.navigate('MainTabs', { screen: 'POS' }) },
            { icon: 'barcode-scan',          titleBn: 'বারকোড স্ক্যান',      titleEn: 'Barcode Scanner',    subBn: 'ক্যামেরা স্ক্যানার',     subEn: 'Camera scanner',       go: () => setShowScanner(true) },
            { icon: 'arrow-down-bold-box',   titleBn: 'স্টক',              titleEn: 'Stock',       subBn: 'নতুন ক্রয় এন্ট্রি',       subEn: 'New purchase',         go: () => navigation.navigate('ProductsScreen', { initialTab: 'purchase' }) },
            { icon: 'cash-check',            titleBn: 'দৈনিক ক্যাশ ক্লোজিং', titleEn: 'Daily Settlement',   subBn: 'দিনের হিসাব বন্ধ',        subEn: 'Day settlement',       go: () => navigation.navigate('SettlementScreen') },
            { icon: 'cash-minus',            titleBn: 'খরচ এন্ট্রি',        titleEn: 'Add Expense',        subBn: 'দৈনিক খরচ লিখুন',         subEn: 'Record expenses',      go: () => navigation.navigate('ExpensesScreen') },
            { icon: 'account-clock',         titleBn: 'বকেয়া আদায়',        titleEn: 'Customer Dues',      subBn: 'বাকির টাকা সংগ্রহ',       subEn: 'Collect dues',         go: () => navigation.navigate('DuesScreen') },
            { icon: 'view-grid-outline',     titleBn: 'পণ্য তালিকা',        titleEn: 'Product List',       subBn: 'ক্যাটালগ ও স্টক',        subEn: 'Catalog & stock',      go: () => navigation.navigate('ProductsScreen') },
            { icon: 'file-document-outline', titleBn: 'রিপোর্ট ও বিশ্লেষণ', titleEn: 'Reports & P&L',      subBn: 'বিক্রয় ও লাভ-ক্ষতি',     subEn: 'Sales & profit',       go: () => navigation.navigate('MainTabs', { screen: 'Reports' }) },
            { icon: 'account-group-outline', titleBn: 'কাস্টমার ডিরেক্টরি', titleEn: 'Customers',         subBn: 'গ্রাহক ও হিস্ট্রি',       subEn: 'Customer history',     go: () => navigation.navigate('CustomersScreen') },
            { icon: 'alert-box-outline',     isAlert: hasStockAlert,
              titleBn: 'স্টক অ্যালার্ট',      titleEn: 'Stock Alert',        subBn: isBN ? ('আউট ' + outOfStockCount + ' · লো ' + lowStockCount) : ('Out ' + outOfStockCount + ' · Low ' + lowStockCount), subEn: ('Out ' + outOfStockCount + ' · Low ' + lowStockCount),
              go: () => navigation.navigate('MainTabs', { screen: 'Inventory' }) },
          ].map((a: any, i: number) => {
            const cardIconColor = a.isAlert ? AppColors.danger : brandColor;
            const cardIconBg = a.isAlert
              ? (isDarkMode ? AppColors.dangerBgDark : AppColors.dangerBgLight)
              : brandBg;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.qaCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                  },
                ]}
                activeOpacity={0.75}
                onPress={a.go}
              >
                <View style={[styles.qaIcon, { backgroundColor: cardIconBg }]}>
                  <MaterialCommunityIcons name={a.icon} size={20} color={cardIconColor} />
                </View>
                <Text
                  style={[styles.qaLabel, { color: theme.colors.onSurface }]}
                  numberOfLines={2}
                >
                  {isBN ? a.titleBn : a.titleEn}
                </Text>
                <Text
                  style={[styles.qaSub, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}
                  numberOfLines={1}
                >
                  {isBN ? a.subBn : a.subEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
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
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 10,
    color: '#64748b',
  },
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  qaCard: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    elevation: 1,
  },
  qaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  qaLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 2,
  },
  qaSub: {
    fontSize: 10,
  },
});
