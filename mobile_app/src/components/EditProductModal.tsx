import React, { useEffect, useState } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Alert, ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, TextInput, Button, Card, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

type Supplier = {
  id: number;
  name: string;
  phone?: string;
};

export default function EditProductModal({ visible, product, onClose, onSaved }: { visible: boolean, product: any, onClose: () => void, onSaved: () => void }) {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  
  const isNew = !product?.id;
  const [form, setForm] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [hideSuggestions, setHideSuggestions] = useState(false);

  // Multi-unit Serial Barcodes (automatic)
  const [serialBarcodes, setSerialBarcodes] = useState<string[]>([]);
  const [currentBarcodeInput, setCurrentBarcodeInput] = useState('');

  // Vendor / Supplier Integration
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [vendorPaidAmount, setVendorPaidAmount] = useState('');
  const [vendorPayMethod, setVendorPayMethod] = useState('cash');

  // Quick Add Vendor Modal
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', address: '' });
  const [savingVendor, setSavingVendor] = useState(false);

  useEffect(() => {
    if (visible) {
      setSuggestions([]);
      setHideSuggestions(false);
      setSerialBarcodes([]);
      setCurrentBarcodeInput('');
      setSelectedSupplier(null); // Default to None
      setVendorPaidAmount('');
      setVendorPayMethod('cash');
      setCategorySearch('');
      setSupplierSearch('');

      api.get('/catalog/categories/').then(res => {
        setCategories(res.data.results || res.data || []);
      }).catch(() => {});

      api.get('/purchasing/suppliers/').then(res => {
        const sups = res.data.results || res.data || [];
        setSuppliers(sups);
      }).catch(() => {});

      if (product && product.id) {
        setForm({
          name: product.name || '',
          sku: product.sku || '',
          barcode: product.barcode || '',
          category: product.category || null,
          category_name: product.category_name || '',
          cost_price: product.cost_price?.toString() || '',
          selling_price: product.selling_price?.toString() || '',
          current_stock: product.current_stock?.toString() || '',
          reorder_level: product.reorder_level?.toString() || '5',
          is_active: product.is_active !== false,
        });
        if (product.barcode) {
          setSerialBarcodes([product.barcode]);
        }
      } else {
        setForm({
          name: '',
          sku: '',
          barcode: '',
          category: null,
          category_name: '',
          cost_price: '',
          selling_price: '',
          current_stock: '0',
          reorder_level: '5',
          is_active: true,
        });
      }
    }
  }, [visible, product]);

  // Live Suggestion Search on Product Name typing
  useEffect(() => {
    if (!visible || !isNew || hideSuggestions || !form.name || form.name.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await api.get('/catalog/products/', {
          params: { search: form.name.trim(), page_size: 6 }
        });
        const list = res.data.results || res.data || [];
        setSuggestions(list);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.name, isNew, visible, hideSuggestions]);

  const selectSuggestion = (item: any) => {
    const catName = item.category_name || (categories.find(c => c.id === item.category)?.name || '');
    setForm({
      ...form,
      name: item.name,
      sku: item.sku || '',
      barcode: item.barcode || '',
      category: item.category || null,
      category_name: catName,
      cost_price: item.cost_price?.toString() || '',
      selling_price: item.selling_price?.toString() || '',
      reorder_level: item.reorder_level?.toString() || '5',
    });
    if (item.barcode) {
      setSerialBarcodes([item.barcode]);
    }
    setCurrentBarcodeInput('');
    setSuggestions([]);
    setHideSuggestions(true);
  };

  // Automatic Barcode Handling
  const addBarcodeToList = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!serialBarcodes.includes(trimmed)) {
      const updated = [...serialBarcodes, trimmed];
      setSerialBarcodes(updated);
      setForm({ ...form, barcode: updated[0], current_stock: updated.length.toString() });
    }
    setCurrentBarcodeInput('');
  };

  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    addBarcodeToList(trimmed);
  };

  const handleBarcodeSubmit = () => {
    if (currentBarcodeInput.trim()) {
      addBarcodeToList(currentBarcodeInput.trim());
    }
  };

  const removeSerialBarcode = (code: string) => {
    const updated = serialBarcodes.filter(b => b !== code);
    setSerialBarcodes(updated);
    if (updated.length > 0) {
      setForm({ ...form, barcode: updated[0], current_stock: updated.length.toString() });
    } else {
      setForm({ ...form, barcode: '', current_stock: '0' });
      setCurrentBarcodeInput('');
    }
  };

  const handleCreateVendor = async () => {
    if (!newVendor.name.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'সরবরাহকারীর নাম আবশ্যক।' : 'Supplier name is required.');
      return;
    }
    setSavingVendor(true);
    try {
      const res = await api.post('/purchasing/suppliers/', newVendor);
      const created = res.data;
      setSuppliers(prev => [...prev, created]);
      setSelectedSupplier(created);
      setShowAddVendor(false);
      setNewVendor({ name: '', phone: '', address: '' });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন সরবরাহকারী তৈরি হয়েছে।' : 'Supplier created successfully!');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || 'Failed to create supplier');
    } finally {
      setSavingVendor(false);
    }
  };

  const saveProduct = async () => {
    Keyboard.dismiss();
    if (!form.name.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'পণ্যের নাম আবশ্যক।' : 'Product name is required.');
      return;
    }
    const cleanSell = String(form.selling_price || '').trim().replace(/,/g, '');
    if (!cleanSell || isNaN(Number(cleanSell))) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'সঠিক বিক্রয় মূল্য আবশ্যক।' : 'Valid selling price is required.');
      return;
    }

    setSaving(true);
    try {
      const cleanCost = String(form.cost_price || '0').trim().replace(/,/g, '');
      const cleanReorder = String(form.reorder_level || '5').trim().replace(/,/g, '');
      const cleanStock = String(form.current_stock || '0').trim().replace(/,/g, '');
      const primaryBarcode = serialBarcodes.length > 0 ? serialBarcodes[0] : (currentBarcodeInput.trim() || form.barcode?.trim() || undefined);

      const payload: any = {
        name: form.name.trim(),
        sku: form.sku?.trim() || undefined,
        barcode: primaryBarcode,
        cost_price: isNaN(Number(cleanCost)) ? '0' : cleanCost,
        selling_price: cleanSell,
        reorder_level: isNaN(Number(cleanReorder)) ? 5 : Number(cleanReorder),
        category: form.category || null,
      };

      if (isNew) {
        const initialQty = (!isNaN(Number(cleanStock)) ? Number(cleanStock) : 0) || (serialBarcodes.length > 0 ? serialBarcodes.length : 0);
        payload.initial_stock = initialQty;
        const res = await api.post('/catalog/products/', payload);
        const createdProd = res.data;

        // Auto-push vendor inward if stock > 0 and supplier is selected
        if (initialQty > 0 && createdProd?.id && selectedSupplier) {
          try {
            const poRes = await api.post('/purchasing/purchase-orders/', {
              supplier: selectedSupplier.id,
              items: [{
                product: createdProd.id,
                quantity: initialQty,
                unit_cost: Number(form.cost_price) || 0,
                barcodes: serialBarcodes.length > 1 ? serialBarcodes : []
              }]
            });
            if (poRes.data?.id) {
              await api.post(`/purchasing/purchase-orders/${poRes.data.id}/receive/`, {
                paid: Number(vendorPaidAmount) || 0,
                method: vendorPayMethod
              });
            }
          } catch (poErr) {
            console.error('PO auto-inward error:', poErr);
          }
        }

        Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন পণ্য সফলভাবে যুক্ত হয়েছে!' : 'Product added successfully!');
      } else {
        await api.patch(`/catalog/products/${product.id}/`, payload);
        Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পণ্য আপডেট সম্পন্ন হয়েছে!' : 'Product updated successfully!');
      }
      onSaved();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || (isBN ? 'পণ্য সেভ করতে ব্যর্থ হয়েছে।' : 'Could not save product'));
    } finally {
      setSaving(false);
    }
  };

  const PAY_METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'bank', label: isBN ? 'ব্যাংক' : 'Bank' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
  ];

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || 
    (s.phone && s.phone.includes(supplierSearch))
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onClose} />
        <View style={{ 
          backgroundColor: theme.colors.background, 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24, 
          position: 'absolute', bottom: 0, alignSelf: 'center',
          width: '100%', maxWidth: 500,
          height: '90%',
          paddingBottom: 20
        }}>
        {/* Header */}
        <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#2563eb' }}>
            {isNew ? (isBN ? 'নতুন পণ্য যোগ করুন' : 'Add New Product') : (isBN ? 'পণ্য এডিট করুন' : 'Edit Product')}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={28} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          {/* Product Name Input */}
          <TextInput 
            mode="outlined" 
            label={isBN ? 'পণ্যের নাম *' : 'Product Name *'} 
            value={form.name} 
            onChangeText={t => {
              setHideSuggestions(false);
              setForm({...form, name: t});
            }} 
            right={loadingSuggestions ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color="#2563eb" />} /> : undefined}
            style={{ marginBottom: 4, backgroundColor: theme.colors.surface }} 
          />

          {/* Autocomplete Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <Card style={{ marginBottom: 12, backgroundColor: theme.colors.surface, elevation: 3, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb' }}>
                  {isBN ? '💡 বিদ্যমান পণ্য তালিকা (ট্যাপ করে অটো-ফিল করুন):' : '💡 Matching Products (Tap to autofill):'}
                </Text>
                <TouchableOpacity onPress={() => setSuggestions([])} style={{ padding: 2 }}>
                  <MaterialCommunityIcons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Divider style={{ marginVertical: 4 }} />
              {suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={item.id || idx}
                  onPress={() => selectSuggestion(item)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: idx < suggestions.length - 1 ? 1 : 0,
                    borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9',
                    backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc'
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      {item.sku ? `SKU: ${item.sku}` : ''} {item.barcode ? `| Barcode: ${item.barcode}` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#16a34a' }}>
                      ৳{Number(item.selling_price || 0).toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          )}

          {/* Category Selector Button */}
          <View style={{ marginBottom: 12, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setShowCategoryPicker(true)}
              style={{
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 8,
                padding: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: theme.colors.surface
              }}
            >
              <Text style={{ fontSize: 14, color: form.category_name ? theme.colors.onSurface : '#64748b', fontWeight: form.category_name ? 'bold' : 'normal' }}>
                {form.category_name || (isBN ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* SKU and Single Unified Barcode Field */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <TextInput 
              mode="outlined" 
              label="SKU" 
              value={form.sku} 
              onChangeText={t => setForm({...form, sku: t})} 
              style={{ flex: 1, marginRight: 8, marginBottom: 12, backgroundColor: theme.colors.surface }} 
            />
            <TextInput 
              mode="outlined" 
              label={isBN ? "বারকোড / সিরিয়াল" : "Barcode / Serial"} 
              placeholder={serialBarcodes.length > 0 ? (isBN ? '+ আরেকটি বারকোড...' : '+ Another barcode...') : (isBN ? 'বারকোড লিখুন...' : 'e.g. 123584')}
              value={currentBarcodeInput} 
              onChangeText={t => {
                if (t.includes(',') || t.includes('\n')) {
                  const parts = t.split(/[,\n]+/).map(p => p.trim()).filter(p => p.length > 0);
                  parts.forEach(p => addBarcodeToList(p));
                } else {
                  setCurrentBarcodeInput(t);
                }
              }} 
              onSubmitEditing={handleBarcodeSubmit}
              returnKeyType="done"
              right={
                <TextInput.Icon 
                  icon="barcode-scan" 
                  onPress={() => setShowCameraScanner(true)} 
                />
              }
              style={{ flex: 1, marginLeft: 8, marginBottom: 12, backgroundColor: theme.colors.surface }} 
            />
          </View>

          {/* Automatically rendered Barcode chips if barcodes are scanned/entered */}
          {serialBarcodes.length > 0 && (
            <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb' }}>
                  ✓ {isBN ? `মোট ${serialBarcodes.length} টি বারকোড যুক্ত হয়েছে:` : `Total ${serialBarcodes.length} barcode(s) added:`}
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b' }}>
                  {isBN ? '(টাইপ করে Enter চাপুন বা স্ক্যান করুন)' : '(Type & press Enter or scan)'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {serialBarcodes.map((code, idx) => (
                  <Chip
                    key={`${code}-${idx}`}
                    onClose={() => removeSerialBarcode(code)}
                    style={{ backgroundColor: isDarkMode ? '#334155' : '#dbeafe' }}
                    textStyle={{ fontSize: 11, color: '#1e40af' }}
                  >
                    #{idx + 1}: {code}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {/* Cost Price and Selling Price */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TextInput 
              mode="outlined" 
              label={isBN ? 'ক্রয় মূল্য (৳)' : 'Cost Price (৳)'} 
              value={form.cost_price} 
              keyboardType="numeric"
              onChangeText={t => setForm({...form, cost_price: t})} 
              style={{ flex: 1, marginRight: 8, marginBottom: 12, backgroundColor: theme.colors.surface }} 
            />
            <TextInput 
              mode="outlined" 
              label={isBN ? 'বিক্রয় মূল্য (৳) *' : 'Selling Price (৳) *'} 
              value={form.selling_price} 
              keyboardType="numeric"
              onChangeText={t => setForm({...form, selling_price: t})} 
              style={{ flex: 1, marginLeft: 8, marginBottom: 12, backgroundColor: theme.colors.surface }} 
            />
          </View>

          {/* Initial Stock and Reorder Level */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {isNew && (
              <TextInput 
                mode="outlined" 
                label={isBN ? 'প্রাথমিক স্টক (পরিমাণ)' : 'Initial Stock (Qty)'} 
                value={form.current_stock} 
                keyboardType="numeric"
                onChangeText={t => setForm({...form, current_stock: t})} 
                style={{ flex: 1, marginRight: 8, marginBottom: 12, backgroundColor: theme.colors.surface }} 
              />
            )}
            <TextInput 
              mode="outlined" 
              label={isBN ? 'রিঅর্ডার লেভেল' : 'Reorder Level'} 
              value={form.reorder_level} 
              keyboardType="numeric"
              onChangeText={t => setForm({...form, reorder_level: t})} 
              style={{ flex: 1, marginLeft: isNew ? 8 : 0, marginBottom: 12, backgroundColor: theme.colors.surface }} 
            />
          </View>

          {/* Vendor / Supplier Selection and Push Section */}
          {isNew && Number(form.current_stock || 0) > 0 && (
            <Card style={{ marginBottom: 16, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', borderWidth: 1, borderColor: '#86efac' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#16a34a' }}>
                  🚚 {isBN ? 'সরবরাহকারী / ভেন্ডর নির্বাচন (Vendor Push - ঐচ্ছিক):' : 'Supplier / Vendor Push (Optional):'}
                </Text>
                <TouchableOpacity onPress={() => setShowAddVendor(true)}>
                  <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 12 }}>+ {isBN ? 'নতুন ভেন্ডর' : 'New Vendor'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setShowSupplierPicker(true)}
                style={{
                  borderWidth: 1,
                  borderColor: selectedSupplier ? '#16a34a' : '#cbd5e1',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surface
                }}
              >
                <Text style={{ fontSize: 14, color: selectedSupplier ? '#16a34a' : '#64748b', fontWeight: selectedSupplier ? 'bold' : 'normal' }}>
                  {selectedSupplier ? `✓ ${selectedSupplier.name}` : (isBN ? 'সরবরাহকারী নির্বাচন করুন (ঐচ্ছিক)' : 'Select Supplier (Optional)')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>

              {selectedSupplier && (
                <>
                  {/* Total Purchase Cost calculation for this product */}
                  <View style={{ backgroundColor: isDarkMode ? '#334155' : '#ffffff', padding: 10, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: '#cbd5e1' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'সাবটোটাল' : 'Subtotal'}</Text>
                      <Text style={{ fontSize: 13, color: theme.colors.onSurface }}>
                        ৳{(Number(form.cost_price || 0) * Number(form.current_stock || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.onSurface }}>{isBN ? 'মোট মূল্য' : 'Total Amount'}</Text>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#16a34a' }}>
                        ৳{(Number(form.cost_price || 0) * Number(form.current_stock || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* Paid to Vendor with Pay Full button */}
                  <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                    {isBN ? 'সাপ্লায়ারকে এখন পরিশোধ করা হলো' : 'Paid to Supplier Now'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    <TextInput
                      mode="outlined"
                      dense
                      label={isBN ? 'টাকা' : 'BDT'}
                      value={vendorPaidAmount}
                      onChangeText={setVendorPaidAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      style={{ flex: 1, backgroundColor: theme.colors.surface }}
                    />
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => setVendorPaidAmount((Number(form.cost_price || 0) * Number(form.current_stock || 0)).toString())}
                      style={{ justifyContent: 'center', borderColor: '#16a34a' }}
                      textColor="#16a34a"
                    >
                      {isBN ? 'সম্পূর্ণ পরিশোধ করুন' : 'Pay Full'}
                    </Button>
                  </View>

                  <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                    {isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {PAY_METHODS.map(m => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setVendorPayMethod(m.key)}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
                          borderWidth: 1, borderColor: vendorPayMethod === m.key ? '#16a34a' : '#ccc',
                          backgroundColor: vendorPayMethod === m.key ? '#dcfce7' : theme.colors.surface
                        }}
                      >
                        <Text style={{ fontSize: 11, color: vendorPayMethod === m.key ? '#16a34a' : theme.colors.onSurface, fontWeight: vendorPayMethod === m.key ? 'bold' : 'normal' }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Supplier Due After Payment */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                      {isBN ? 'পরিশোধের পর সাপ্লায়ারের বকেয়া' : 'Supplier Due After Payment'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: Math.max(0, (Number(form.cost_price || 0) * Number(form.current_stock || 0)) - (Number(vendorPaidAmount) || 0)) > 0 ? '#ea580c' : '#16a34a' }}>
                      ৳{Math.max(0, (Number(form.cost_price || 0) * Number(form.current_stock || 0)) - (Number(vendorPaidAmount) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </>
              )}
            </Card>
          )}

          <Button mode="contained" buttonColor="#2563eb" onPress={saveProduct} loading={saving} disabled={saving} style={{ paddingVertical: 6, marginTop: 4 }}>
            {isBN ? (isNew ? 'পণ্য ও স্টক যুক্ত করুন' : 'সেভ করুন') : (isNew ? 'Add Product & Push Stock' : 'Save Changes')}
          </Button>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>

      {/* Robust Supplier Selector Modal */}
      <Modal visible={showSupplierPicker} transparent animationType="fade" onRequestClose={() => setShowSupplierPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowSupplierPicker(false)}>
          <Card style={{ width: '100%', maxWidth: 420, maxHeight: '80%', padding: 16, backgroundColor: theme.colors.surface }} onPress={e => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a' }}>
                {isBN ? 'সরবরাহকারী / ভেন্ডর নির্বাচন করুন' : 'Select Supplier / Vendor'}
              </Text>
              <TouchableOpacity onPress={() => setShowSupplierPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              mode="outlined"
              dense
              placeholder={isBN ? 'ভেন্ডর খুঁজুন...' : 'Search supplier...'}
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {/* Option: None */}
              <TouchableOpacity
                onPress={() => { setSelectedSupplier(null); setShowSupplierPicker(false); }}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: selectedSupplier === null ? '#2563eb' : '#e2e8f0',
                  backgroundColor: selectedSupplier === null ? (isDarkMode ? '#1e293b' : '#eff6ff') : 'transparent'
                }}
              >
                <Text style={{ fontWeight: 'bold', color: selectedSupplier === null ? '#2563eb' : theme.colors.onSurface }}>
                  🚫 {isBN ? 'কোনো সরবরাহকারী নয় (None)' : 'None (No Supplier)'}
                </Text>
              </TouchableOpacity>

              {/* Suppliers List */}
              {filteredSuppliers.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => { setSelectedSupplier(s); setShowSupplierPicker(false); }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: selectedSupplier?.id === s.id ? '#16a34a' : '#e2e8f0',
                    backgroundColor: selectedSupplier?.id === s.id ? (isDarkMode ? '#1e293b' : '#f0fdf4') : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <View>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: selectedSupplier?.id === s.id ? '#16a34a' : theme.colors.onSurface }}>
                      {s.name}
                    </Text>
                    {s.phone ? <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📞 {s.phone}</Text> : null}
                  </View>
                  {selectedSupplier?.id === s.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))}

              {filteredSuppliers.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#64748b', padding: 16 }}>
                  {isBN ? 'কোনো সরবরাহকারী পাওয়া যায়নি।' : 'No suppliers found.'}
                </Text>
              )}
            </ScrollView>

            <Button
              mode="text"
              icon="plus"
              onPress={() => { setShowSupplierPicker(false); setShowAddVendor(true); }}
              style={{ marginTop: 8 }}
            >
              {isBN ? '+ নতুন সরবরাহকারী তৈরি করুন' : '+ Create New Supplier'}
            </Button>
          </Card>
        </TouchableOpacity>
      </Modal>

      {/* Robust Category Selector Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <Card style={{ width: '100%', maxWidth: 420, maxHeight: '80%', padding: 16, backgroundColor: theme.colors.surface }} onPress={e => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2563eb' }}>
                {isBN ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category'}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              mode="outlined"
              dense
              placeholder={isBN ? 'ক্যাটাগরি খুঁজুন...' : 'Search category...'}
              value={categorySearch}
              onChangeText={setCategorySearch}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                onPress={() => { setForm({ ...form, category: null, category_name: '' }); setShowCategoryPicker(false); }}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: form.category === null ? '#2563eb' : '#e2e8f0',
                  backgroundColor: form.category === null ? (isDarkMode ? '#1e293b' : '#eff6ff') : 'transparent'
                }}
              >
                <Text style={{ fontWeight: 'bold', color: form.category === null ? '#2563eb' : theme.colors.onSurface }}>
                  🚫 {isBN ? 'ক্যাটাগরি ছাড়া (None)' : 'None'}
                </Text>
              </TouchableOpacity>

              {filteredCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setForm({ ...form, category: c.id, category_name: c.name }); setShowCategoryPicker(false); }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: form.category === c.id ? '#2563eb' : '#e2e8f0',
                    backgroundColor: form.category === c.id ? (isDarkMode ? '#1e293b' : '#eff6ff') : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: form.category === c.id ? '#2563eb' : theme.colors.onSurface }}>
                    {c.name}
                  </Text>
                  {form.category === c.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </Modal>

      {/* Quick Add Vendor Modal */}
      <Modal visible={showAddVendor} transparent animationType="fade" onRequestClose={() => setShowAddVendor(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 400, padding: 16, backgroundColor: theme.colors.surface }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
              {isBN ? 'নতুন সরবরাহকারী / ভেন্ডর যোগ করুন' : 'Add New Vendor / Supplier'}
            </Text>
            <TextInput
              mode="outlined"
              label={isBN ? 'ভেন্ডরের নাম *' : 'Vendor Name *'}
              value={newVendor.name}
              onChangeText={t => setNewVendor({ ...newVendor, name: t })}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'মোবাইল নম্বর' : 'Phone'}
              value={newVendor.phone}
              onChangeText={t => setNewVendor({ ...newVendor, phone: t })}
              keyboardType="phone-pad"
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />
            <TextInput
              mode="outlined"
              label={isBN ? 'ঠিকানা' : 'Address'}
              value={newVendor.address}
              onChangeText={t => setNewVendor({ ...newVendor, address: t })}
              style={{ marginBottom: 16, backgroundColor: theme.colors.surface }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button disabled={savingVendor} onPress={() => setShowAddVendor(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
              <Button mode="contained" buttonColor="#16a34a" loading={savingVendor} disabled={savingVendor} onPress={handleCreateVendor}>
                {isBN ? 'যোগ করুন' : 'Add Vendor'}
              </Button>
            </View>
          </Card>
        </View>
      </Modal>

      <CameraBarcodeScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </Modal>
  );
}