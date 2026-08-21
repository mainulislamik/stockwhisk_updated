import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, useTheme } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

const RANGES = [
  { label: 'Today', labelBN: 'আজকের', days: 1, rangeKey: 'today' },
  { label: '7d', labelBN: '৭ দিন', days: 7, rangeKey: '7d' },
  { label: '30d', labelBN: '৩০ দিন', days: 30, rangeKey: '30d' },
  { label: 'This Month', labelBN: 'চলতি মাস', days: 30, rangeKey: 'this_month' },
  { label: 'This Year', labelBN: 'চলতি বছর', days: 365, rangeKey: 'this_year' },
];

export default function ReportsScreen() {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [selectedRange, setSelectedRange] = useState(RANGES[2]);
  const [overview, setOverview] = useState<any>(null);
  const [comprehensive, setComprehensive] = useState<any>(null);
  const [profitOverview, setProfitOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedRange])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ovRes, compRes, profitRes] = await Promise.all([
        api.get('/analytics/sales-overview/').catch(() => ({ data: null })),
        api.get('/analytics/dashboard-comprehensive/', { params: { days: selectedRange.days } }).catch(() => ({ data: null })),
        api.get('/analytics/profit-overview/', { params: { range: selectedRange.rangeKey } }).catch(() => ({ data: null })),
      ]);
      if (ovRes.data) setOverview(ovRes.data);
      if (compRes.data) setComprehensive(compRes.data);
      if (profitRes.data) setProfitOverview(profitRes.data);
    } catch (error) {
      console.log('Error fetching reports data', error);
    } finally {
      setLoading(false);
    }
  };

  const chartWidth = Math.min(Dimensions.get('window').width, 500) - 64;

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
              { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface },
            ]}
          >
            <Text style={{ color: isSelected ? '#fff' : theme.colors.onSurface, fontWeight: 'bold' }}>
              {isBN ? range.labelBN : range.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (loading && !overview && !comprehensive) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const topProducts = comprehensive?.top_products || [];
  const topCustomers = comprehensive?.top_customers || [];
  const paymentMethods = comprehensive?.payment_methods || [];
  const topReturns = comprehensive?.top_returns || [];
  const recentTransactions = comprehensive?.recent_transactions || [];
  const lowStock = comprehensive?.low_stock || [];
  const outOfStock = comprehensive?.out_of_stock || [];
  const salesByCategory = comprehensive?.sales_by_category || [];
  const profitTrend = profitOverview?.trend || [];

  return (
    <ScrollView
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      {renderChips()}

      {loading && <ActivityIndicator style={{ marginBottom: 16 }} />}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'বিক্রয় ওভারভিউ' : 'Sales Overview'}
      </Text>
      <View style={styles.grid}>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'মোট সেলস' : 'Total Sales'}</Text>
            <Text style={styles.cardValue}>৳{Number(overview?.total_sales || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'মোট অর্ডার' : 'Total Orders'}</Text>
            <Text style={styles.cardValue}>{overview?.total_orders || '0'}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'চলতি মাসের সেলস' : 'This Month Sales'}</Text>
            <Text style={styles.cardValue}>৳{Number(overview?.this_month_sales || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'চলতি মাসের অর্ডার' : 'This Month Orders'}</Text>
            <Text style={styles.cardValue}>{overview?.this_month_orders || '0'}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'আজকের সেলস' : "Today's Sales"}</Text>
            <Text style={styles.cardValue}>৳{Number(overview?.today_sales || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'আজকের অর্ডার' : "Today's Orders"}</Text>
            <Text style={styles.cardValue}>{overview?.today_orders || '0'}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'গত মাসের সেলস' : "Last Month's Sales"}</Text>
            <Text style={styles.cardValue}>৳{Number(overview?.last_month_sales || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'গত মাসের অর্ডার' : "Last Month's Orders"}</Text>
            <Text style={styles.cardValue}>{overview?.last_month_orders || '0'}</Text>
          </Card.Content>
        </Card>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'প্রফিট ওভারভিউ' : 'Profit Overview'}
      </Text>
      <View style={styles.grid}>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'গ্রস প্রফিট' : 'Gross Profit'}</Text>
            <Text style={[styles.cardValue, { color: '#16a34a' }]}>৳{Number(profitOverview?.summary?.gross_profit || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'মোট খরচ' : 'Total Cost'}</Text>
            <Text style={[styles.cardValue, { color: '#dc2626' }]}>৳{Number(profitOverview?.summary?.total_cost || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'প্রফিট মার্জিন' : 'Profit Margin'}</Text>
            <Text style={[styles.cardValue, { color: '#2563eb' }]}>
              {profitOverview?.summary?.profit_margin ? Number(profitOverview.summary.profit_margin).toFixed(2) : '0.00'}%
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.cardHalf}>
          <Card.Content>
            <Text style={{ color: theme.colors.secondary }}>{isBN ? 'গড় প্রফিট / অর্ডার' : 'Avg. Profit / Order'}</Text>
            <Text style={[styles.cardValue, { color: '#0891b2' }]}>৳{Number(profitOverview?.summary?.average_profit_per_order || 0).toLocaleString()}</Text>
          </Card.Content>
        </Card>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'প্রফিট ট্রেন্ড' : 'Profit Trend'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {profitTrend.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <View style={{ width: 10, height: 10, backgroundColor: '#2563eb', marginRight: 4, borderRadius: 5 }} />
                  <Text style={{ fontSize: 10 }}>{isBN ? 'রেভিনিউ' : 'Revenue'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <View style={{ width: 10, height: 10, backgroundColor: '#dc2626', marginRight: 4, borderRadius: 5 }} />
                  <Text style={{ fontSize: 10 }}>{isBN ? 'খরচ' : 'Cost'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, backgroundColor: '#16a34a', marginRight: 4, borderRadius: 5 }} />
                  <Text style={{ fontSize: 10 }}>{isBN ? 'প্রফিট' : 'Profit'}</Text>
                </View>
              </View>
              <LineChart
                data={{
                  labels: (() => {
                    if (profitTrend.length <= 1) {
                      return profitTrend.length === 1 ? [new Date(profitTrend[0].date).getDate().toString(), ''] : [''];
                    }
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
                      color: (opacity = 1) => 'rgba(37, 99, 235, ' + opacity + ')',
                    },
                    {
                      data: profitTrend.length === 1
                        ? [Number(profitTrend[0].cost) || 0, Number(profitTrend[0].cost) || 0]
                        : profitTrend.map((d: any) => Number(d.cost) || 0),
                      color: (opacity = 1) => 'rgba(220, 38, 38, ' + opacity + ')',
                    },
                    {
                      data: profitTrend.length === 1
                        ? [Number(profitTrend[0].profit) || 0, Number(profitTrend[0].profit) || 0]
                        : profitTrend.map((d: any) => Number(d.profit) || 0),
                      color: (opacity = 1) => 'rgba(22, 163, 74, ' + opacity + ')',
                    },
                  ],
                  legend: [],
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
                  color: (opacity = 1) => 'rgba(100, 116, 139, ' + opacity + ')',
                  labelColor: (opacity = 1) => 'rgba(100, 116, 139, ' + opacity + ')',
                  style: { borderRadius: 16 },
                  propsForDots: { r: '3', strokeWidth: '1', stroke: theme.colors.surface },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </>
          ) : (
            <Text style={{ textAlign: 'center', marginVertical: 20 }}>{isBN ? 'কোন তথ্য নেই' : 'No data available'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'শীর্ষ পণ্য' : 'Top Products'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {topProducts.length > 0 ? (
            topProducts.map((p: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{p.product__name || p.name || p.product_name || `Product #${i + 1}`}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.secondary }}>{isBN ? 'পরিমাণ' : 'Qty'}: {p.qty || p.quantity || 0}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>৳{Number(p.revenue || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোনো ডাটা নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'শীর্ষ কাস্টমার' : 'Top Customers'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {topCustomers.length > 0 ? (
            topCustomers.map((c: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{c.customer__name || c.name || c.customer_name || `Customer #${i + 1}`}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.secondary }}>{isBN ? 'অর্ডার' : 'Orders'}: {c.order_count || c.orders || 0}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>৳{Number(c.total_spent || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোনো ডাটা নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'পেমেন্ট মেথড' : 'Payment Methods'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {paymentMethods.length > 0 ? (
            paymentMethods.map((pm: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <Text style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{pm.method || pm.payment_method || 'Cash'}</Text>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>৳{Number(pm.total || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোন তথ্য নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'ক্যাটাগরি অনুযায়ী সেলস' : 'Sales by Category'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {salesByCategory.length > 0 ? (
            salesByCategory.map((c: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <Text style={{ fontWeight: 'bold' }}>{c.product__category__name || (isBN ? 'ক্যাটাগরি ছাড়া' : 'Uncategorized')}</Text>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>৳{Number(c.revenue || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোন তথ্য নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{t.invoice_number}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.secondary }}>{t.customer_name || 'Walk-in'} • {t.payment_method}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>৳{Number(t.total || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোন তথ্য নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'শীর্ষ রিটার্ন পণ্য' : 'High Return Products'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {topReturns.length > 0 ? (
            topReturns.map((r: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{r.sale_item__product__name}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.error }}>{isBN ? 'রিটার্ন পরিমাণ' : 'Return Qty'}: {r.qty}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.error }}>৳{Number(r.refund_amount || 0).toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'কোন তথ্য নেই' : 'No data'}</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {isBN ? 'ইনভেন্টরি স্ট্যাটাস' : 'Inventory Status'}
      </Text>
      <Card style={styles.fullCard}>
        <Card.Content>
          {outOfStock.length > 0 || lowStock.length > 0 ? (
            <>
              {outOfStock.slice(0, 5).map((s: any, i: number) => (
                <View key={`out-${i}`} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{s.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.error }}>{isBN ? 'স্টক আউট' : 'Out of Stock'}</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.error }}>0</Text>
                </View>
              ))}
              {lowStock.slice(0, 5).map((s: any, i: number) => (
                <View key={`low-${i}`} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{s.name}</Text>
                    <Text style={{ fontSize: 12, color: '#d97706' }}>{isBN ? 'লো স্টক' : 'Low Stock'} (Min: {s.reorder_level})</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: '#d97706' }}>{s.current_stock}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={{ textAlign: 'center' }}>{isBN ? 'সব ঠিক আছে' : 'Inventory Healthy'}</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardHalf: {
    width: '48%',
    marginBottom: 12,
  },
  cardThird: {
    width: '31%',
    marginBottom: 12,
  },
  fullCard: {
    marginBottom: 16,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
});
