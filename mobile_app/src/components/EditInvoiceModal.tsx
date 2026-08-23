import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, TextInput, Button, Card, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

type CartItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

type Product = {
  id: number;
  name: string;
  selling_price: string;
  current_stock: string;
  sku?: string;
  barcode?: string;
};

export default function EditInvoiceModal({
  visible,
  sale,
  onClose,
  onSaved,
}: {
  visible: boolean;
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const { user } = useAuth();
  const isBN = language === 'BN';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleDiscount, setSaleDiscount] = useState('0');
  const [saleTax, setSaleTax] = useState('0');
  const [saleDelivery, setSaleDelivery] = useState('0');
  const [reason, setReason] = useState('');

  // Product Search & Camera
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  useEffect(() => {
    if (!visible || !sale) return;

    setError('');
    setReason('');
    setSearchQuery('');
    setSearchResults([]);

    // Check if owner
    if (user?.role && user.role !== 'owner' && user.role !== 'admin') {
      setError(isBN ? 'শুধুমাত্র দোকানের মালিক ইনভয়েস সংশোধন করতে পারেন।' : 'Only the Shop Owner can edit invoices.');
      return;
    }

    setLoading(true);
    api.get(`/sales/sales/${sale.id}/`)
      .then(res => {
        const data = res.data;
        if (data.returns && data.returns.length > 0) {
          setError(isBN ? 'যেসব ইনভয়েসে পণ্য রিটার্ন হয়েছে তা সংশোধন করা যাবে না।' : 'Invoices with existing returns cannot be edited.');
          return;
        }

        setCustomerName(data.bill_name && data.bill_name !== 'Walk-in customer' ? data.bill_name : '');
        setCustomerPhone(data.bill_phone || '');
        setCustomerAddress(data.bill_address || '');
        setSaleDiscount(data.discount?.toString() || '0');
        setSaleTax(data.tax?.toString() || '0');
        setSaleDelivery(data.delivery_charge?.toString() || '0');

        const items: CartItem[] = (data.items || []).map((item: any) => ({
          product_id: item.product_id || item.product?.id || item.id,
          product_name: item.product_name || item.product?.name || 'Product',
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          discount: Number(item.discount) || 0,
        }));
        setCart(items);
      })
      .catch(err => {
        setError(err.response?.data?.detail || err.message || (isBN ? 'ইনভয়েস লোড করা যায়নি।' : 'Failed to load invoice.'));
      })
      .finally(() => setLoading(false));
  }, [visible, sale, user]);

  // Search Products
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      setSearching(true);
      api.get('/catalog/products/', { params: { search: searchQuery.trim(), page_size: 6 } })
        .then(res => setSearchResults(res.data.results || res.data || []))
        .catch(() => {})
        .finally(() => setSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleAddProduct = (p: Product) => {
    const existingIndex = cart.findIndex(c => c.product_id === p.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: 1,
          unit_price: Number(p.selling_price) || 0,
          discount: 0,
        },
      ]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUpdateCart = (idx: number, field: keyof CartItem, val: number) => {
    const updated = [...cart];
    updated[idx] = { ...updated[idx], [field]: val };
    setCart(updated);
  };

  const handleRemoveCart = (idx: number) => {
    const updated = cart.filter((_, i) => i !== idx);
    setCart(updated);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity - item.discount, 0);
  const total = Math.max(0, subtotal - (Number(saleDiscount) || 0) + (Number(saleTax) || 0) + (Number(saleDelivery) || 0));
  const previouslyPaid = sale ? Number(sale.paid || 0) : 0;
  const newDue = total - previouslyPaid;

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'ইনভয়েসে অন্তত একটি পণ্য থাকতে হবে।' : 'At least one product is required.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'ইনভয়েস সংশোধনের কারণ লেখা বাধ্যতামূলক।' : 'Correction reason is required.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/sales/sales/${sale.id}/correct/`, {
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_address: customerAddress.trim() || undefined,
        items: cart.map(c => ({
          product_id: c.product_id,
          quantity: c.quantity,
          unit_price: c.unit_price,
          discount: c.discount,
        })),
        discount: Number(saleDiscount) || 0,
        tax: Number(saleTax) || 0,
        delivery_charge: Number(saleDelivery) || 0,
        correction_reason: reason.trim(),
        reason: reason.trim(),
      });

      Alert.alert(
        isBN ? 'সফল!' : 'Success!',
        isBN ? `ইনভয়েস #${sale.invoice_no} সফলভাবে সংশোধন করা হয়েছে!` : `Invoice #${sale.invoice_no} corrected successfully!`
      );
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.response?.data?.detail || err.message || (isBN ? 'সংশোধন ব্যর্থ হয়েছে।' : 'Could not correct invoice.'));
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !sale) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            position: 'absolute',
            bottom: 0,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 500,
            height: '92%',
            paddingBottom: 20,
          }}
        >
        {/* Header */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            padding: 18,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View>
            <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#f59e0b' }}>
              ✏️ {isBN ? `ইনভয়েস সংশোধন: #${sale.invoice_no}` : `Edit Invoice: #${sale.invoice_no}`}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              {isBN ? 'মূল্য, পণ্য বা কাস্টমার তথ্য পরিবর্তন করুন' : 'Correct items, pricing, or customer info'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={26} color="#64748b" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={{ marginTop: 10, color: '#64748b' }}>{isBN ? 'ইনভয়েস লোড হচ্ছে...' : 'Loading invoice...'}</Text>
          </View>
        ) : error ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={{ color: '#ef4444', textAlign: 'center', marginTop: 12, fontSize: 14 }}>{error}</Text>
            <Button mode="outlined" onPress={onClose} style={{ marginTop: 20 }}>
              {isBN ? 'বন্ধ করুন' : 'Close'}
            </Button>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* Customer Info Card */}
            <Card style={{ padding: 12, marginBottom: 14, backgroundColor: theme.colors.surface }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#2563eb', marginBottom: 8 }}>
                👤 {isBN ? 'কাস্টমার তথ্য' : 'Customer Information'}
              </Text>
              <TextInput
                mode="outlined"
                dense
                label={isBN ? 'কাস্টমারের নাম' : 'Customer Name'}
                value={customerName}
                onChangeText={setCustomerName}
                style={{ marginBottom: 6, backgroundColor: theme.colors.surface }}
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'মোবাইল নম্বর' : 'Phone'}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'ঠিকানা' : 'Address'}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
              </View>
            </Card>

            {/* Product Search & Add */}
            <Card style={{ padding: 12, marginBottom: 14, backgroundColor: theme.colors.surface }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#16a34a', marginBottom: 8 }}>
                🔍 {isBN ? 'পণ্য খুঁজুন ও যুক্ত করুন' : 'Search & Add Products'}
              </Text>
              <TextInput
                mode="outlined"
                dense
                placeholder={isBN ? 'পণ্যের নাম বা বারকোড খুঁজুন...' : 'Search product or barcode...'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                left={<TextInput.Icon icon="magnify" />}
                right={<TextInput.Icon icon="barcode-scan" onPress={() => setShowCameraScanner(true)} />}
                style={{ backgroundColor: theme.colors.surface }}
              />

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <View style={{ marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 150 }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {searchResults.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => handleAddProduct(p)}
                        style={{
                          padding: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                        }}
                      >
                        <View>
                          <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{p.name}</Text>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>Stock: {p.current_stock}</Text>
                        </View>
                        <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 13 }}>৳{p.selling_price}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </Card>

            {/* Cart Items List */}
            <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, color: theme.colors.onSurface }}>
              🛒 {isBN ? 'ইনভয়েসের পণ্য তালিকা' : 'Invoice Items'} ({cart.length})
            </Text>
            {cart.map((item, idx) => (
              <Card
                key={`${item.product_id}-${idx}`}
                style={{ padding: 10, marginBottom: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 13, flex: 1 }}>{item.product_name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveCart(idx)} style={{ padding: 2 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    mode="outlined"
                    dense
                    label={isBN ? 'পরিমাণ' : 'Qty'}
                    value={item.quantity.toString()}
                    keyboardType="numeric"
                    onChangeText={t => handleUpdateCart(idx, 'quantity', Math.max(1, Number(t) || 1))}
                    style={{ flex: 1, backgroundColor: theme.colors.surface }}
                  />
                  <TextInput
                    mode="outlined"
                    dense
                    label={isBN ? 'দর (৳)' : 'Price (৳)'}
                    value={item.unit_price.toString()}
                    keyboardType="numeric"
                    onChangeText={t => handleUpdateCart(idx, 'unit_price', Number(t) || 0)}
                    style={{ flex: 1, backgroundColor: theme.colors.surface }}
                  />
                  <TextInput
                    mode="outlined"
                    dense
                    label={isBN ? 'ছাড় (৳)' : 'Disc (৳)'}
                    value={item.discount.toString()}
                    keyboardType="numeric"
                    onChangeText={t => handleUpdateCart(idx, 'discount', Number(t) || 0)}
                    style={{ flex: 1, backgroundColor: theme.colors.surface }}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2563eb' }}>
                    {isBN ? 'আইটেম মোট:' : 'Item Total:'} ৳{(item.unit_price * item.quantity - item.discount).toFixed(2)}
                  </Text>
                </View>
              </Card>
            ))}

            {/* Calculations & Discounts */}
            <Card style={{ padding: 12, marginTop: 6, marginBottom: 14, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#64748b' }}>{isBN ? 'সাবটোটাল' : 'Subtotal'}</Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold' }}>৳{subtotal.toFixed(2)}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'মোট ছাড় (৳)' : 'Sale Disc (৳)'}
                  value={saleDiscount}
                  keyboardType="numeric"
                  onChangeText={setSaleDiscount}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'ভ্যাট/ট্যাক্স (৳)' : 'Tax (৳)'}
                  value={saleTax}
                  keyboardType="numeric"
                  onChangeText={setSaleTax}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'ডেলিভারি (৳)' : 'Delivery (৳)'}
                  value={saleDelivery}
                  keyboardType="numeric"
                  onChangeText={setSaleDelivery}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{isBN ? 'নতুন সর্বমোট মূল্য' : 'New Total'}</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2563eb' }}>৳{total.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>{isBN ? 'পূর্বে পরিশোধিত' : 'Previously Paid'}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>৳{previouslyPaid.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: newDue < 0 ? '#f59e0b' : newDue > 0 ? '#ef4444' : '#16a34a' }}>
                  {newDue < 0 ? (isBN ? 'কাস্টমার রিফান্ড পাবে:' : 'Refund Owed to Customer:') : (isBN ? 'পরিশোধযোগ্য নতুন বাকি:' : 'New Due Balance:')}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: newDue < 0 ? '#f59e0b' : newDue > 0 ? '#ef4444' : '#16a34a' }}>
                  ৳{Math.abs(newDue).toFixed(2)}
                </Text>
              </View>
            </Card>

            {/* Mandatory Reason Input */}
            <Card style={{ padding: 12, marginBottom: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#fde047' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#b45309', marginBottom: 4 }}>
                ⚠️ {isBN ? 'ইনভয়েস সংশোধনের কারণ (বাধ্যতামূলক) *' : 'Reason for Edit (Mandatory) *'}
              </Text>
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={2}
                placeholder={isBN ? 'যেমন: কাস্টমার একটি পণ্য পরিবর্তন করেছেন...' : 'e.g. Customer changed item / pricing correction...'}
                value={reason}
                onChangeText={setReason}
                style={{ backgroundColor: theme.colors.surface, marginTop: 4 }}
              />
            </Card>

            {/* Submit Button */}
            <Button
              mode="contained"
              buttonColor="#f59e0b"
              icon="check-bold"
              loading={saving}
              disabled={saving || cart.length === 0 || !reason.trim()}
              onPress={handleSubmit}
              style={{ paddingVertical: 6, borderRadius: 8 }}
            >
              {isBN ? 'ইনভয়েস সংশোধন সম্পন্ন করুন' : 'Save Invoice Corrections'}
            </Button>
          </ScrollView>
        )}
      </View>
      </KeyboardAvoidingView>

      <CameraBarcodeScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanned={(code) => {
          setShowCameraScanner(false);
          setSearchQuery(code);
        }}
      />
    </Modal>
  );
}
