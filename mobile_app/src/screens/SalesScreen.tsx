import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { Appbar, Text, Card, Divider, Chip, TextInput, ActivityIndicator, useTheme, Modal, Portal, Button, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import EditInvoiceModal from '../components/EditInvoiceModal';

type Sale = {
  id: number;
  invoice_no?: string;
  invoice_number?: string;
  customer_name: string | null;
  customer_phone?: string | null;
  sale_date: string;
  total: string;
  paid: string;
  due: string;
  status: string;
  discount?: string;
  delivery_charge?: string;
  items?: any[];
  public_invoice_url?: string;
  pdf_url?: string;
};

export default function SalesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const { user } = useAuth();
  const isBN = language === 'BN';
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSales([]);
    setHasMore(true);
    fetchSales(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const fetchSales = async (pageNum: number, searchQuery: string, isRefresh = false) => {
    if (loading || (!hasMore && !isRefresh)) return;
    setLoading(true);
    try {
      const res = await api.get('/sales/sales/', {
        params: {
          page: pageNum,
          page_size: 50,
          search: searchQuery
        }
      });
      const newSales = res.data.results || res.data; 
      const salesArray = Array.isArray(newSales) ? newSales : [];
      
      setSales(prev => isRefresh ? salesArray : [...prev, ...salesArray]);
      setHasMore(salesArray.length === 50 || !!res.data.next);
      setPage(pageNum + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaleClick = async (sale: Sale) => {
    setSelectedSale(sale);
    setDetailLoading(true);
    try {
      const res = await api.get(`/sales/sales/${sale.id}/`);
      if (res.data) {
        setSelectedSale(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const onScroll = ({ nativeEvent }: any) => {
    const isCloseToBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 50;
    if (isCloseToBottom) {
      fetchSales(page, debouncedSearch);
    }
  };

  const getStatusColor = (status: string) => {
    switch((status || '').toUpperCase()) {
      case 'PAID': return '#16a34a'; // green
      case 'PARTIAL': return '#ea580c'; // orange
      case 'DUE': return '#dc2626'; // red
      case 'CANCELLED': return '#64748b'; // gray
      default: return theme.colors.primary;
    }
  };

  const getStatusLabel = (status: string) => {
    if (!isBN) return status;
    switch((status || '').toUpperCase()) {
      case 'PAID': return 'পরিশোধিত';
      case 'PARTIAL': return 'আংশিক';
      case 'DUE': return 'বকেয়া';
      case 'CANCELLED': return 'বাতিল';
      default: return status;
    }
  };

  const generateReceiptHTML = (sale: Sale) => {
    const itemsHtml = (sale.items || []).map((it: any) => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ddd;">${it.product_name || it.name || 'Product'}</td>
        <td style="text-align: center; padding: 4px 0; border-bottom: 1px dashed #ddd;">${it.quantity}</td>
        <td style="text-align: right; padding: 4px 0; border-bottom: 1px dashed #ddd;">${Number(it.unit_price || 0).toFixed(2)}</td>
        <td style="text-align: right; padding: 4px 0; border-bottom: 1px dashed #ddd;">${Number(it.subtotal || (it.quantity * it.unit_price) || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page { margin: 0; }
          body { font-family: monospace, -apple-system, sans-serif; padding: 6px; max-width: 300px; margin: 0 auto; color: #000; font-size: 11px; }
          .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 6px; }
          .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
          .info { font-size: 10px; color: #333; margin-bottom: 1px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
          th { border-bottom: 1px dashed #000; padding: 3px 1px; font-size: 10px; text-align: left; }
          td { padding: 3px 1px; vertical-align: top; word-break: break-word; }
          .totals { margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px; font-size: 11px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .bold { font-weight: bold; }
          .footer { text-align: center; margin-top: 10px; font-size: 10px; border-top: 1px dashed #000; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${user?.shop_name || 'StockWhisk Store'}</div>
          <div class="info">Invoice: #${sale.invoice_no || sale.invoice_number || sale.id}</div>
          <div class="info">Date: ${sale.sale_date?.slice(0, 10) || ''}</div>
          <div class="info">Customer: ${sale.customer_name || 'Walk-in'} ${sale.customer_phone ? `(${sale.customer_phone})` : ''}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45%;">Item</th>
              <th style="width: 15%; text-align: center;">Qty</th>
              <th style="width: 20%; text-align: right;">Price</th>
              <th style="width: 20%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Total:</span><span class="bold">Tk ${Number(sale.total || 0).toFixed(2)}</span></div>
          <div class="row"><span>Paid:</span><span>Tk ${Number(sale.paid || 0).toFixed(2)}</span></div>
          ${Number(sale.due || 0) > 0 ? `<div class="row bold"><span>Due:</span><span>Tk ${Number(sale.due).toFixed(2)}</span></div>` : ''}
        </div>
        <div class="footer">Thank you for your business!</div>
      </body>
      </html>
    `;
  };

  const handlePrint = async (sale: Sale) => {
    try {
      if (Platform.OS === 'web') {
        window.open(`https://stockwhisk.com/invoice/${sale.id}`, '_blank');
      } else {
        const html = generateReceiptHTML(sale);
        await Print.printAsync({ html });
      }
    } catch (e) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'প্রিন্ট করতে ব্যর্থ হয়েছে।' : 'Could not print invoice.');
    }
  };

  const handleWhatsApp = (sale: Sale) => {
    const phone = sale.customer_phone || '';
    const digits = phone.replace(/\D/g, '');
    const intl = digits.startsWith('880') ? digits : (digits.startsWith('01') ? `88${digits}` : digits);
    const invoiceUrl = `https://stockwhisk.com/invoice/${sale.id}`;
    const name = sale.customer_name || (isBN ? 'সম্মানিত গ্রাহক' : 'Valued Customer');
    const totalVal = Number(sale.total || 0).toFixed(2);
    const paidVal = Number(sale.paid || 0).toFixed(2);
    const dueVal = Number(sale.due || 0).toFixed(2);
    const dueLineBN = Number(sale.due || 0) > 0 ? `\nবকেয়া: ৳${dueVal}` : '';
    const dueLineEN = Number(sale.due || 0) > 0 ? `\nDue: ৳${dueVal}` : '';

    const msg = isBN 
      ? `হ্যালো ${name},\n\nআপনার ইনভয়েস #${sale.invoice_no || sale.invoice_number || sale.id}\nমোট বিল: ৳${totalVal}\nপরিশোধিত: ৳${paidVal}${dueLineBN}\n\nইনভয়েস দেখতে লিংকে যান: ${invoiceUrl}\n\nআমাদের সাথে থাকার জন্য ধন্যবাদ!`
      : `Hello ${name},\n\nYour invoice #${sale.invoice_no || sale.invoice_number || sale.id}\nTotal Bill: ৳${totalVal}\nPaid: ৳${paidVal}${dueLineEN}\n\nView your invoice here: ${invoiceUrl}\n\nThank you for shopping with us!`;

    const waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'বিক্রয় ইতিহাস' : 'Sales History'} titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>
      
      <View style={styles.searchContainer}>
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'ইনভয়েস বা গ্রাহকের নাম খুঁজুন...' : 'Filter by invoice or customer...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ backgroundColor: theme.colors.surface }}
        />
      </View>

      <View style={styles.listContainer}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEventThrottle={400}
        >
          {sales.map((sale, index) => {
            const inv = sale.invoice_no || sale.invoice_number || `#${sale.id}`;
            return (
              <Card key={`${sale.id}-${index}`} style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={() => handleSaleClick(sale)}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text style={styles.invoiceNo}>{inv}</Text>
                    <Chip textStyle={{ color: 'white', fontWeight: 'bold', fontSize: 11 }} style={{ backgroundColor: getStatusColor(sale.status), height: 26 }}>
                      {getStatusLabel(sale.status)}
                    </Chip>
                  </View>
                  <Text style={[styles.customerName, { color: isDarkMode ? '#cbd5e1' : '#475569' }]}>{sale.customer_name || (isBN ? 'সাধারণ ক্রেতা' : 'Walk-in Customer')}</Text>
                  <Text style={styles.date}>{new Date(sale.sale_date).toLocaleDateString()}</Text>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.rowBetween}>
                    <Text style={{ fontWeight: '600' }}>{isBN ? 'মোট:' : 'Total:'} ৳{Number(sale.total || 0).toFixed(2)}</Text>
                    {Number(sale.due || 0) > 0 && (
                      <Text style={styles.dueText}>{isBN ? 'বকেয়া:' : 'Due:'} ৳{Number(sale.due).toFixed(2)}</Text>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })}
          {loading && <ActivityIndicator style={styles.loader} color={theme.colors.primary} />}
          {!loading && sales.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="receipt" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
              <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'কোনো বিক্রয় তথ্য পাওয়া যায়নি' : 'No sales records found'}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Sale Detail Modal */}
      <Portal>
        <Modal
          visible={!!selectedSale}
          onDismiss={() => setSelectedSale(null)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 16,
            padding: 20,
            borderRadius: 12,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 480,
            maxHeight: '85%'
          }}
        >
          {selectedSale && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {selectedSale.invoice_no || selectedSale.invoice_number || `#${selectedSale.id}`}
                </Text>
                <Chip textStyle={{ color: 'white', fontWeight: 'bold' }} style={{ backgroundColor: getStatusColor(selectedSale.status) }}>
                  {getStatusLabel(selectedSale.status)}
                </Chip>
              </View>

              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginBottom: 4 }}>
                {isBN ? 'তারিখ:' : 'Date:'} {new Date(selectedSale.sale_date).toLocaleString()}
              </Text>
              <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, marginBottom: 12 }}>
                {isBN ? 'গ্রাহক:' : 'Customer:'} {selectedSale.customer_name || (isBN ? 'সাধারণ ক্রেতা' : 'Walk-in Customer')}
                {selectedSale.customer_phone ? ` (${selectedSale.customer_phone})` : ''}
              </Text>
              {!!(selectedSale as any).courier_name && (
                <Text style={{ color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontSize: 13, marginBottom: 12, fontWeight: '600' }}>
                  🚚 {isBN ? 'কুরিয়ার:' : 'Courier:'} {(selectedSale as any).courier_name}
                  {!!(selectedSale as any).tracking_code ? ` (Track: ${(selectedSale as any).tracking_code})` : ''}
                </Text>
              )}

              <Divider style={{ marginVertical: 12 }} />

              {detailLoading ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color={theme.colors.primary} />
              ) : (
                <>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
                    {isBN ? 'আইটেম তালিকা' : 'Items List'}
                  </Text>
                  
                  {selectedSale.items && selectedSale.items.length > 0 ? (
                    selectedSale.items.map((item: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontWeight: '600', fontSize: 13 }}>{item.product_name || item.name || 'Product'}</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            {item.quantity} x ৳{Number(item.unit_price || 0).toFixed(2)}
                          </Text>
                          {item.units && item.units.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {item.units.map((u: any, uIdx: number) => (
                                <View key={uIdx} style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 10, fontFamily: 'monospace', color: isDarkMode ? '#93c5fd' : '#1e40af' }}>
                                    {u.barcode || u.serial_number || String(u)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Text style={{ fontWeight: 'bold', fontSize: 13 }}>
                          ৳{Number(item.subtotal || (item.quantity * item.unit_price) || 0).toFixed(2)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic', fontSize: 13 }}>
                      {isBN ? 'কোনো আইটেম নেই' : 'No items'}
                    </Text>
                  )}

                  <View style={{ marginTop: 16, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'মোট বিল:' : 'Total Bill:'}</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold' }}>৳{Number(selectedSale.total || 0).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#16a34a' }}>{isBN ? 'পরিশোধিত:' : 'Paid:'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#16a34a' }}>৳{Number(selectedSale.paid || 0).toFixed(2)}</Text>
                    </View>
                    {Number(selectedSale.due || 0) > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, color: '#dc2626' }}>{isBN ? 'বকেয়া:' : 'Due:'}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#dc2626' }}>৳{Number(selectedSale.due).toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              <View style={{ marginTop: 20, gap: 8 }}>
                {/* Allow Edit if Owner */}
                {(!user?.role || user.role === 'owner' || user.role === 'admin') && (
                  <Button
                    mode="contained"
                    icon="pencil"
                    buttonColor="#f59e0b"
                    textColor="#fff"
                    onPress={() => {
                      const current = selectedSale;
                      setSelectedSale(null);
                      setEditingSale(current);
                    }}
                  >
                    {isBN ? '✏️ ইনভয়েস সংশোধন করুন' : '✏️ Edit / Correct Invoice'}
                  </Button>
                )}

                <Button mode="contained" icon="printer" buttonColor="#4f46e5" onPress={() => handlePrint(selectedSale)}>
                  {isBN ? 'ইনভয়েস প্রিন্ট / দেখুন' : 'Print / View Invoice'}
                </Button>

                {selectedSale.customer_phone && selectedSale.customer_phone.replace(/\D/g, '').length >= 10 && (
                  <Button mode="contained" icon="whatsapp" buttonColor="#25D366" textColor="#fff" onPress={() => handleWhatsApp(selectedSale)}>
                    {isBN ? 'হোয়াটসঅ্যাপে পাঠান' : 'Send to WhatsApp'}
                  </Button>
                )}

                <Button mode="outlined" onPress={() => setSelectedSale(null)}>
                  {isBN ? 'বন্ধ করুন' : 'Close'}
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        visible={!!editingSale}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
        onSaved={() => {
          setEditingSale(null);
          setPage(1);
          setSales([]);
          setHasMore(true);
          fetchSales(1, debouncedSearch, true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { flex: 1, position: 'relative' },
  scrollView: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  searchContainer: { padding: 16, backgroundColor: 'transparent' },
  card: { marginBottom: 12, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNo: { fontWeight: 'bold', fontSize: 16 },
  customerName: { marginTop: 4, fontSize: 14 },
  date: { marginTop: 2, fontSize: 12, color: '#888' },
  divider: { marginVertical: 8 },
  dueText: { color: '#dc2626', fontWeight: 'bold' },
  loader: { marginVertical: 20 }
});
