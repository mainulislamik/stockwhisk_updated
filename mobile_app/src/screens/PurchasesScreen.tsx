import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, Text, Card, TextInput, ActivityIndicator, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

export default function PurchasesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language } = usePreferences();
  const isBn = language === 'BN';
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async (p = 1, q = '') => {
    try {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      
      const res = await api.get('/purchasing/purchase-orders/?page=' + p + '&page_size=30&search=' + encodeURIComponent(q));
      
      if (p === 1) {
        setPurchases(res.data.results || []);
      } else {
        setPurchases(prev => [...prev, ...(res.data.results || [])]);
      }
      
      setHasMore(!!res.data.next);
      setPage(p + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      if (!loadingMore && hasMore) {
        fetchData(page, search);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'RECEIVED': return '#22c55e';
      case 'PARTIAL': return '#f59e0b';
      case 'ORDERED': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBn ? "ক্রয় ইতিহাস" : "Purchases"} titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>
      
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput 
          mode="outlined" 
          placeholder={isBn ? "পিও নম্বর বা সরবরাহকারী খুঁজুন..." : "Search PO or Supplier..."} 
          value={search} 
          onChangeText={setSearch} 
          left={<TextInput.Icon icon="magnify" />}
          style={{ marginBottom: 16, backgroundColor: theme.colors.surface }}
        />
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <ScrollView 
          style={{ position: 'absolute', top: 136, left: 0, right: 0, bottom: 0 }} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {purchases.map(po => (
            <Card key={po.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{po.po_number || '#' + po.id}</Text>
                  <View style={{ backgroundColor: getStatusColor(po.status), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text variant="bodySmall" style={{ color: '#fff', fontWeight: 'bold' }}>{po.status}</Text>
                  </View>
                </View>
                <Text style={{ color: theme.colors.secondary, marginTop: 4, marginBottom: 8, fontSize: 14 }}>{po.supplier_name || (isBn ? 'সরবরাহকারী' : 'Supplier')}</Text>
                
                <View style={styles.rowBetween}>
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'তারিখ:' : 'Date:'} {po.order_date}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'মোট' : 'Total'}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14 }}>৳ {Number(po.total).toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'পরিশোধিত' : 'Paid'}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#16a34a' }}>৳ {Number(po.paid).toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'বকেয়া' : 'Due'}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: Number(po.due) > 0 ? '#dc2626' : theme.colors.onSurface }}>
                      ৳ {Number(po.due).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
          {loadingMore && <ActivityIndicator style={{ marginVertical: 10 }} color={theme.colors.primary} />}
          {!loading && purchases.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.secondary }}>{isBn ? 'কোনো ক্রয়ের তথ্য পাওয়া যায়নি' : 'No purchase records found'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
