import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, RefreshControl, Modal, FlatList } from 'react-native';
import { Appbar, Text, Card, TextInput, Button, useTheme, Divider, Chip, ActivityIndicator, IconButton, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import PageGuideButton from '../components/PageGuideButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  due?: number;
}

interface Product {
  id: number;
  name: string;
  barcode?: string;
  cost_price?: number;
  selling_price?: number;
  stock?: number;
}

interface PurchaseLine {
  product: Product;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export default function NewPurchaseScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { language } = usePreferences();
  const isBn = language === 'BN';

  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Line items
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  // Payment & Details
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'mobile_banking'>('cash');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const res = await api.get('/purchasing/suppliers/?page_size=100');
      const list = res.data.results || res.data || [];
      setSuppliers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchProducts = async (q = '') => {
    try {
      setLoadingProducts(true);
      const res = await api.get('/catalog/products/?page_size=50&search=' + encodeURIComponent(q));
      const list = res.data.results || res.data || [];
      setProducts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.phone && s.phone.includes(supplierSearch))
    );
  }, [suppliers, supplierSearch]);

  const addProductLine = (prod: Product) => {
    const existingIndex = lines.findIndex(l => l.product.id === prod.id);
    if (existingIndex > -1) {
      const updated = [...lines];
      const cur = updated[existingIndex];
      const newQty = cur.quantity + 1;
      updated[existingIndex] = {
        ...cur,
        quantity: newQty,
        subtotal: newQty * cur.unit_cost
      };
      setLines(updated);
    } else {
      const cost = Number(prod.cost_price || 0);
      setLines(prev => [
        ...prev,
        {
          product: prod,
          quantity: 1,
          unit_cost: cost,
          subtotal: cost
        }
      ]);
    }
    setShowProductModal(false);
  };

  const updateQuantity = (index: number, qtyStr: string) => {
    const val = parseFloat(qtyStr) || 0;
    const updated = [...lines];
    updated[index].quantity = val;
    updated[index].subtotal = val * updated[index].unit_cost;
    setLines(updated);
  };

  const updateCost = (index: number, costStr: string) => {
    const val = parseFloat(costStr) || 0;
    const updated = [...lines];
    updated[index].unit_cost = val;
    updated[index].subtotal = updated[index].quantity * val;
    setLines(updated);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  // Totals
  const subtotal = useMemo(() => {
    return lines.reduce((acc, cur) => acc + cur.subtotal, 0);
  }, [lines]);

  const numDiscount = parseFloat(discount) || 0;
  const netTotal = Math.max(0, subtotal - numDiscount);
  const numPaid = parseFloat(paid) || 0;
  const due = Math.max(0, netTotal - numPaid);

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      Alert.alert(isBn ? 'সাপ্লায়ার প্রয়োজন' : 'Supplier Required', isBn ? 'অনুগ্রহ করে একজন সরবরাহকারী নির্বাচন করুন।' : 'Please select a supplier.');
      return;
    }
    if (lines.length === 0) {
      Alert.alert(isBn ? 'পণ্য প্রয়োজন' : 'Items Required', isBn ? 'অন্তত একটি পণ্য যুক্ত করুন।' : 'Add at least one product.');
      return;
    }

    try {
      setSubmitting(true);
      const poData = {
        supplier: selectedSupplier.id,
        discount: numDiscount,
        note: note.trim(),
        due_date: due > 0 && dueDate ? dueDate : null,
        items: lines.map(l => ({
          product: l.product.id,
          quantity: l.quantity,
          unit_cost: l.unit_cost
        }))
      };

      const poRes = await api.post('/purchasing/purchase-orders/', poData);
      const poId = poRes.data?.id;

      // Now receive into stock immediately
      await api.post("/purchasing/purchase-orders/" + poId + "/receive/", {
        paid: numPaid,
        method: paymentMethod,
        due_date: due > 0 && dueDate ? dueDate : null
      });

      Alert.alert(
        isBn ? 'সফল হয়েছে!' : 'Success!',
        isBn ? 'পণ্য সফলভাবে স্টকে যুক্ত ও ভাউচার তৈরি হয়েছে।' : 'Purchase received into stock successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || (isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save purchase');
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBn ? 'নতুন মাল ক্রয় (Purchase)' : 'New Purchase Order'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/products/purchase" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
        {/* Supplier Selector */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
              {isBn ? '🏢 সরবরাহকারী (Supplier)' : '🏢 Supplier Information'}
            </Text>
            {selectedSupplier ? (
              <View style={styles.supplierSelectedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{selectedSupplier.name}</Text>
                  {selectedSupplier.phone && <Text style={{ color: theme.colors.secondary }}>📞 {selectedSupplier.phone}</Text>}
                </View>
                <Button mode="outlined" compact onPress={() => setShowSupplierModal(true)}>
                  {isBn ? 'পরিবর্তন' : 'Change'}
                </Button>
              </View>
            ) : (
              <Button
                mode="contained-tonal"
                icon="account-search"
                onPress={() => setShowSupplierModal(true)}
                style={{ marginTop: 4 }}
              >
                {isBn ? 'সরবরাহকারী নির্বাচন করুন' : 'Select Supplier'}
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Product Items Table */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface, marginTop: 12 }]}>
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                {isBn ? '📦 পণ্যের তালিকা (Line Items)' : '📦 Purchased Items'} ({lines.length})
              </Text>
              <Button
                mode="contained"
                compact
                icon="plus"
                onPress={() => {
                  fetchProducts();
                  setShowProductModal(true);
                }}
              >
                {isBn ? '+ পণ্য যোগ' : '+ Add Item'}
              </Button>
            </View>

            {lines.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <MaterialCommunityIcons name="cart-outline" size={40} color={theme.colors.secondary} />
                <Text style={{ color: theme.colors.secondary, marginTop: 8 }}>
                  {isBn ? 'এখনো কোনো পণ্য নির্বাচন করা হয়নি।' : 'No items added yet.'}
                </Text>
              </View>
            ) : (
              lines.map((line, idx) => (
                <View key={idx} style={styles.lineItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{line.product.name}</Text>
                      {line.product.barcode && (
                        <Text style={{ fontSize: 11, color: theme.colors.secondary }}>{line.product.barcode}</Text>
                      )}
                    </View>
                    <IconButton
                      icon="close-circle"
                      size={20}
                      iconColor="#dc2626"
                      onPress={() => removeLine(idx)}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                        {isBn ? 'পরিমাণ (Qty)' : 'Quantity'}
                      </Text>
                      <TextInput
                        mode="outlined"
                        dense
                        keyboardType="numeric"
                        value={line.quantity.toString()}
                        onChangeText={t => updateQuantity(idx, t)}
                        style={{ backgroundColor: theme.colors.surface }}
                      />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                        {isBn ? 'ক্রয়মূল্য (Unit Cost)' : 'Unit Cost'}
                      </Text>
                      <TextInput
                        mode="outlined"
                        dense
                        keyboardType="numeric"
                        value={line.unit_cost.toString()}
                        onChangeText={t => updateCost(idx, t)}
                        style={{ backgroundColor: theme.colors.surface }}
                      />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                        {isBn ? 'মোট' : 'Subtotal'}
                      </Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 14, color: theme.colors.primary }}>
                        ৳ {line.subtotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Divider style={{ marginVertical: 10 }} />
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Financial Summary & Payment */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface, marginTop: 12 }]}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12 }}>
              {isBn ? '💰 পেমেন্ট ও ইনভয়েস বিবরণ' : '💰 Payment & Bill Details'}
            </Text>

            <View style={styles.calcRow}>
              <Text>{isBn ? 'উপমোট (Subtotal):' : 'Subtotal:'}</Text>
              <Text style={{ fontWeight: 'bold' }}>৳ {subtotal.toFixed(2)}</Text>
            </View>

            <View style={[styles.calcRow, { alignItems: 'center' }]}>
              <Text>{isBn ? 'ছাড়/ডিসকাউন্ট (Discount):' : 'Discount:'}</Text>
              <TextInput
                mode="outlined"
                dense
                keyboardType="numeric"
                value={discount}
                onChangeText={setDiscount}
                style={{ width: 120, textAlign: 'right', backgroundColor: theme.colors.surface }}
              />
            </View>

            <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 }]}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{isBn ? 'সর্বমোট প্রদেয় (Net Total):' : 'Net Total:'}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.primary }}>৳ {netTotal.toFixed(2)}</Text>
            </View>

            <View style={[styles.calcRow, { alignItems: 'center', marginTop: 10 }]}>
              <Text style={{ fontWeight: 'bold' }}>{isBn ? 'পরিশোধিত (Paid Amount):' : 'Paid Amount:'}</Text>
              <TextInput
                mode="outlined"
                dense
                keyboardType="numeric"
                placeholder="0"
                value={paid}
                onChangeText={setPaid}
                style={{ width: 120, textAlign: 'right', backgroundColor: theme.colors.surface }}
              />
            </View>

            {/* Payment Method Selector */}
            <View style={{ marginTop: 10 }}>
              <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginBottom: 6 }}>
                {isBn ? 'পেমেন্ট মেথড (Payment Method):' : 'Payment Method:'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip
                  selected={paymentMethod === 'cash'}
                  onPress={() => setPaymentMethod('cash')}
                  icon="cash"
                >
                  {isBn ? 'ক্যাশ (Cash)' : 'Cash'}
                </Chip>
                <Chip
                  selected={paymentMethod === 'bank'}
                  onPress={() => setPaymentMethod('bank')}
                  icon="bank"
                >
                  {isBn ? 'ব্যাংক' : 'Bank'}
                </Chip>
                <Chip
                  selected={paymentMethod === 'mobile_banking'}
                  onPress={() => setPaymentMethod('mobile_banking')}
                  icon="cellphone"
                >
                  {isBn ? 'বিকাশ/নগদ' : 'MFS'}
                </Chip>
              </View>
            </View>

            {/* Due Balance Display */}
            <View style={[styles.calcRow, { marginTop: 12, backgroundColor: due > 0 ? '#fef2f2' : '#f0fdf4', padding: 8, borderRadius: 6 }]}>
              <Text style={{ fontWeight: 'bold', color: due > 0 ? '#dc2626' : '#16a34a' }}>
                {isBn ? 'বকেয়া থাকবে (Due):' : 'Balance Due:'}
              </Text>
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: due > 0 ? '#dc2626' : '#16a34a' }}>
                ৳ {due.toFixed(2)}
              </Text>
            </View>

            {due > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                  {isBn ? 'বকেয়া পরিশোধের প্রতিশ্রুতি তারিখ (YYYY-MM-DD):' : 'Promised Due Date (YYYY-MM-DD):'}
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  placeholder="2026-11-15"
                  value={dueDate}
                  onChangeText={setDueDate}
                  style={{ backgroundColor: theme.colors.surface, marginTop: 4 }}
                />
              </View>
            )}

            <TextInput
              mode="outlined"
              dense
              label={isBn ? 'চালান বা নোট (Optional Memo)' : 'Invoice # / Note'}
              value={note}
              onChangeText={setNote}
              style={{ backgroundColor: theme.colors.surface, marginTop: 12 }}
            />
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          icon="check-circle"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={{ marginTop: 16, paddingVertical: 4 }}
        >
          {isBn ? 'ক্রয় সম্পন্ন ও স্টক রিসিভ করুন' : 'Confirm & Receive Into Stock'}
        </Button>
      </ScrollView>

      {/* Supplier Selection Modal */}
      <Modal visible={showSupplierModal} animationType="slide" transparent onRequestClose={() => setShowSupplierModal(false)}>
        <View style={styles.modalOverlay}>
          <Surface style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{isBn ? 'সরবরাহকারী বাছাই করুন' : 'Select Supplier'}</Text>
              <IconButton icon="close" size={20} onPress={() => setShowSupplierModal(false)} />
            </View>
            <TextInput
              mode="outlined"
              dense
              placeholder={isBn ? 'নাম বা ফোন দিয়ে খুঁজুন...' : 'Search by name or phone...'}
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              left={<TextInput.Icon icon="magnify" />}
              style={{ marginHorizontal: 12, marginBottom: 8 }}
            />
            {loadingSuppliers ? (
              <ActivityIndicator style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={filteredSuppliers}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.selectItem}
                    onPress={() => {
                      setSelectedSupplier(item);
                      setShowSupplierModal(false);
                    }}
                  >
                    <View>
                      <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
                      {item.phone && <Text style={{ fontSize: 12, color: theme.colors.secondary }}>{item.phone}</Text>}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.secondary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </Surface>
        </View>
      </Modal>

      {/* Product Selection Modal */}
      <Modal visible={showProductModal} animationType="slide" transparent onRequestClose={() => setShowProductModal(false)}>
        <View style={styles.modalOverlay}>
          <Surface style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{isBn ? 'পণ্য নির্বাচন করুন' : 'Select Product'}</Text>
              <IconButton icon="close" size={20} onPress={() => setShowProductModal(false)} />
            </View>
            <TextInput
              mode="outlined"
              dense
              placeholder={isBn ? 'বারকোড বা পণ্যের নাম...' : 'Search product or barcode...'}
              value={productSearch}
              onChangeText={t => {
                setProductSearch(t);
                fetchProducts(t);
              }}
              left={<TextInput.Icon icon="magnify" />}
              style={{ marginHorizontal: 12, marginBottom: 8 }}
            />
            {loadingProducts ? (
              <ActivityIndicator style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={products}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.selectItem}
                    onPress={() => addProductLine(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                        {item.barcode && <Text style={{ fontSize: 11, color: theme.colors.secondary }}>🏷️ {item.barcode}</Text>}
                        <Text style={{ fontSize: 11, color: '#16a34a' }}>ক্রয়: ৳{Number(item.cost_price || 0).toFixed(0)}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.secondary }}>বর্তমান স্টক: {item.stock || 0}</Text>
                      </View>
                    </View>
                    <Button mode="contained-tonal" compact>
                      {isBn ? 'যোগ' : 'Add'}
                    </Button>
                  </TouchableOpacity>
                )}
              />
            )}
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 8,
    elevation: 2,
  },
  supplierSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  lineItem: {
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  selectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});
