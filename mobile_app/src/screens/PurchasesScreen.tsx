import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, Text, Card, TextInput, ActivityIndicator, useTheme, Button } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
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
  const searchSeqRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async (p = 1, q = '') => {
    const seq = ++searchSeqRef.current;
    try {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      
      const res = await api.get('/purchasing/purchase-orders/?page=' + p + '&page_size=30&search=' + encodeURIComponent(q));
      if (seq !== searchSeqRef.current) return;
      
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
      if (seq === searchSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
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

  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [poDetailLoading, setPoDetailLoading] = useState(false);

  const handlePOClick = async (po: any) => {
    setSelectedPO(po);
    setPoDetailLoading(true);
    try {
      const res = await api.get(`/purchasing/purchase-orders/${po.id}/`);
      if (res.data) {
        setSelectedPO(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPoDetailLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <PageGuideButton pageKey="/app/products/purchase" />
        <Appbar.Content title={isBn ? "ক্রয় ইতিহাস" : "Purchases"} titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>
      
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput 
          mode="outlined" 
          placeholder={isBn ? "পিও নম্বর বা সরবরাহকারী খুঁজুন..." : "Search PO or Supplier..."} 
          value={search} 
          onChangeText={setSearch} 
          left={<TextInput.Icon icon="magnify" />}
          style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}
        />
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {purchases.map(po => (
            <Card key={po.id} style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={() => handlePOClick(po)}>
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{po.po_number || '#' + po.id}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {['pending', 'ordered'].includes(po.status?.toLowerCase()) && po.order_date && (new Date().getTime() - new Date(po.order_date).getTime() > 5 * 86400000) && (
                      <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text variant="bodySmall" style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>
                          {isBn ? '⚠️ বিলম্বিত' : '⚠️ Overdue'}
                        </Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: getStatusColor(po.status), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text variant="bodySmall" style={{ color: '#fff', fontWeight: 'bold' }}>{po.status}</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: theme.colors.secondary, marginTop: 4, marginBottom: 8, fontSize: 14 }}>{po.supplier_name || (isBn ? 'সরবরাহকারী' : 'Supplier')}</Text>
                
                <View style={styles.rowBetween}>
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'তারিখ:' : 'Date:'} {po.order_date}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'মোট' : 'Total'}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14 }}>৳ {Number(po.total || 0).toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'পরিশোধিত' : 'Paid'}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#16a34a' }}>৳ {Number(po.paid || 0).toFixed(2)}</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{isBn ? 'বকেয়া' : 'Due'}</Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: Number(po.due || 0) > 0 ? '#dc2626' : theme.colors.onSurface }}>
                      ৳ {Number(po.due || 0).toFixed(2)}
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

      {/* PO Detail Modal */}
      {selectedPO && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <Card style={{ backgroundColor: theme.colors.surface, maxHeight: '80%' }}>
              <Card.Title
                title={selectedPO.po_number || `#${selectedPO.id}`}
                subtitle={`${selectedPO.supplier_name || 'Supplier'} · ${selectedPO.order_date || ''}`}
                titleStyle={{ fontWeight: 'bold' }}
              />
              <Card.Content>
                {poDetailLoading ? (
                  <ActivityIndicator style={{ margin: 20 }} color={theme.colors.primary} />
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 14 }}>
                      {isBn ? 'ক্রয়কৃত পণ্যসমূহ:' : 'Purchased Items:'}
                    </Text>
                    {(selectedPO.items || []).map((it: any, idx: number) => (
                      <View key={it.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', fontSize: 13 }}>{it.product_name || it.product?.name || 'Product'}</Text>
                          <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                            {it.quantity} x ৳{Number(it.unit_cost || 0).toFixed(2)}
                          </Text>
                        </View>
                        <Text style={{ fontWeight: 'bold', fontSize: 13 }}>
                          ৳{Number(it.subtotal || (it.quantity * it.unit_cost) || 0).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ marginTop: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>{isBn ? 'মোট ক্রয়মূল্য:' : 'Total Amount:'}</Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold' }}>৳{Number(selectedPO.total || 0).toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, color: '#16a34a' }}>{isBn ? 'পরিশোধ:' : 'Paid:'}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#16a34a' }}>৳{Number(selectedPO.paid || 0).toFixed(2)}</Text>
                      </View>
                      {Number(selectedPO.due || 0) > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#dc2626' }}>{isBn ? 'বকেয়া:' : 'Due:'}</Text>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#dc2626' }}>৳{Number(selectedPO.due).toFixed(2)}</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                )}
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => setSelectedPO(null)}>{isBn ? 'বন্ধ করুন' : 'Close'}</Button>
              </Card.Actions>
            </Card>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
