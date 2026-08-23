import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, useTheme, FAB, Button, Divider, Menu } from 'react-native-paper';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import ProductDetailModal from '../components/ProductDetailModal';
import EditProductModal from '../components/EditProductModal';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  is_low_stock?: boolean;
  category?: number;
  is_active?: boolean;
  warranty_months?: number;
};

type Category = {
  id: number;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
  phone?: string;
};

export default function ProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  
  // Tab Mode: 'list' or 'purchase'
  const [activeTab, setActiveTab] = useState<'list' | 'purchase'>(route.params?.initialTab || 'list');

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Scanner state ('list' | 'purchase' | null)
  const [scannerTarget, setScannerTarget] = useState<'list' | 'purchase' | null>(null);

  // Product List State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productToEdit, setProductToEdit] = useState<any | null>(null);

  // Purchase / Inward State
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseResults, setPurchaseResults] = useState<Product[]>([]);
  const [selectedPurchaseProduct, setSelectedPurchaseProduct] = useState<Product | null>(null);
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [pushingToStock, setPushingToStock] = useState(false);
  const [purchaseBarcodes, setPurchaseBarcodes] = useState<string[]>([]);
  const [customBarcodeInput, setCustomBarcodeInput] = useState('');

  // Quick Add Vendor state
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', address: '' });
  const [savingVendor, setSavingVendor] = useState(false);

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
      setShowAddVendorModal(false);
      setNewVendor({ name: '', phone: '', address: '' });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'নতুন সরবরাহকারী তৈরি হয়েছে।' : 'Supplier created successfully!');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || 'Failed to create supplier');
    } finally {
      setSavingVendor(false);
    }
  };

  useEffect(() => {
    api.get('/catalog/categories/').then((res: any) => {
      const cats = res.data.results || res.data;
      if (Array.isArray(cats)) setCategories(cats);
    }).catch(() => {});

    api.get('/purchasing/suppliers/').then((res: any) => {
      const sups = res.data.results || res.data;
      if (Array.isArray(sups)) {
        setSuppliers(sups);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'list') {
        setPage(1);
        setProducts([]);
        setHasMore(true);
        fetchProducts(1, debouncedSearch, selectedCategory, true);
      }
    }, [debouncedSearch, selectedCategory, activeTab])
  );

  const fetchProducts = async (pageNum: number, searchQuery: string, cat: number | null, isRefresh = false) => {
    if (loading || (!hasMore && !isRefresh)) return;
    setLoading(true);
    try {
      const res = await api.get('/catalog/products/', {
        params: {
          search: searchQuery,
          page: pageNum,
          page_size: 30,
          category: cat || undefined,
          light: 1
        }
      });
      const newProducts = res.data.results || res.data;
      const productsArray = Array.isArray(newProducts) ? newProducts : [];
      
      setProducts(prev => isRefresh ? productsArray : [...prev, ...productsArray]);
      setHasMore(productsArray.length === 30 || !!res.data.next);
      setPage(pageNum + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      await api.delete(`/catalog/products/${id}/`);
      setProducts(prev => prev.filter(p => p.id !== id));
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পণ্য ডিলিট করা হয়েছে।' : 'Product deleted successfully.');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.message || 'Failed to delete');
    }
  };

  const confirmDelete = (p: Product) => {
    Alert.alert(
      isBN ? 'নিশ্চিত করুন' : 'Confirm Delete',
      isBN ? `${p.name} ডিলিট করতে চান?` : `Are you sure you want to delete ${p.name}?`,
      [
        { text: isBN ? 'বাতিল' : 'Cancel', style: 'cancel' },
        { text: isBN ? 'ডিলিট' : 'Delete', style: 'destructive', onPress: () => deleteProduct(p.id) }
      ]
    );
  };

  // Search product for purchase
  useEffect(() => {
    if (purchaseSearch.trim().length > 1) {
      api.get('/catalog/products/', { params: { search: purchaseSearch.trim(), page_size: 10 } })
        .then(res => setPurchaseResults(res.data.results || res.data || []))
        .catch(() => {});
    } else {
      setPurchaseResults([]);
    }
  }, [purchaseSearch]);

  const selectProductForPurchase = (p: Product) => {
    setSelectedPurchaseProduct(p);
    setCostPrice(p.cost_price?.toString() || '');
    setSellingPrice(p.selling_price?.toString() || '');
    setWarrantyMonths(p.warranty_months?.toString() || '0');
    setQuantity('1');
    setPurchaseBarcodes([]);
    setCustomBarcodeInput('');
    setPurchaseSearch('');
    setPurchaseResults([]);
  };

  // Pricing calculations
  const costNum = Number(costPrice) || 0;
  const sellNum = Number(sellingPrice) || 0;
  const qtyNum = Number(quantity) || 1;
  const marginPct = sellNum > 0 ? (((sellNum - costNum) / sellNum) * 100).toFixed(1) : '0.0';
  const profitPerUnit = (sellNum - costNum).toFixed(2);
  const totalPurchaseCost = (costNum * qtyNum).toFixed(2);

  const addPurchaseBarcode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!purchaseBarcodes.includes(trimmed)) {
      const updated = [...purchaseBarcodes, trimmed];
      setPurchaseBarcodes(updated);
      setQuantity(updated.length.toString());
    }
    setCustomBarcodeInput('');
  };

  const removePurchaseBarcode = (code: string) => {
    const updated = purchaseBarcodes.filter(b => b !== code);
    setPurchaseBarcodes(updated);
    if (updated.length > 0) setQuantity(updated.length.toString());
  };

  const handlePushToStock = async () => {
    if (!selectedPurchaseProduct) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'অনুগ্রহ করে একটি প্রোডাক্ট নির্বাচন করুন।' : 'Please select a product.');
      return;
    }
    if (qtyNum <= 0) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'ক্রয়ের পরিমাণ ১ বা তার বেশি হতে হবে।' : 'Quantity must be at least 1.');
      return;
    }

    setPushingToStock(true);
    try {
      // 1. Update product selling price & warranty if changed
      await api.patch(`/catalog/products/${selectedPurchaseProduct.id}/`, {
        cost_price: costPrice,
        selling_price: sellingPrice,
        warranty_months: Number(warrantyMonths) || 0
      }).catch(() => {});

      // 2. Create Purchase Order
      const poRes = await api.post('/purchasing/purchase-orders/', {
        supplier: selectedSupplier ? selectedSupplier.id : null,
        items: [{
          product: selectedPurchaseProduct.id,
          quantity: qtyNum,
          unit_cost: costNum,
          barcodes: purchaseBarcodes
        }]
      });

      const poId = poRes.data.id;

      // 3. Receive the Purchase Order directly into stock
      await api.post(`/purchasing/purchase-orders/${poId}/receive/`, {
        paid: Number(paidAmount) || 0,
        method: payMethod
      });

      Alert.alert(
        isBN ? 'সফল!' : 'Success!',
        isBN ? `${selectedPurchaseProduct.name} এর ${qtyNum} ইউনিট স্টকে সফলভাবে যুক্ত হয়েছে!` : `${qtyNum} unit(s) of ${selectedPurchaseProduct.name} received into stock successfully!`
      );

      // Reset
      setSelectedPurchaseProduct(null);
      setCostPrice('');
      setSellingPrice('');
      setQuantity('1');
      setPurchaseBarcodes([]);
      setPaidAmount('');
      setActiveTab('list');
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e.response?.data?.detail || e.message || (isBN ? 'স্টকে যুক্ত করতে সমস্যা হয়েছে।' : 'Failed to push to stock.'));
    } finally {
      setPushingToStock(false);
    }
  };

  const onScroll = ({ nativeEvent }: any) => {
    const isCloseToBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 50;
    if (isCloseToBottom && activeTab === 'list') {
      fetchProducts(page, debouncedSearch, selectedCategory);
    }
  };

  const PAY_METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'bank', label: isBN ? 'ব্যাংক' : 'Bank' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'পণ্য ও স্টক ইনওয়ার্ড' : 'Products & Inward'} titleStyle={{ fontWeight: 'bold' }} />
        <Button mode="contained" compact buttonColor="#2563eb" style={{ marginRight: 8, borderRadius: 8 }} onPress={() => setProductToEdit({})}>
          {isBN ? '+ নতুন প্রোডাক্ট' : '+ New Product'}
        </Button>
      </Appbar.Header>

      {/* Top Segmented Navigation */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 10, padding: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeTab === 'list' ? '#2563eb' : 'transparent', borderRadius: 8 }}
          onPress={() => setActiveTab('list')}
        >
          <Text style={{ color: activeTab === 'list' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold', fontSize: 13 }}>
            📋 {isBN ? 'প্রোডাক্ট লিস্ট' : 'Product List'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeTab === 'purchase' ? '#2563eb' : 'transparent', borderRadius: 8 }}
          onPress={() => setActiveTab('purchase')}
        >
          <Text style={{ color: activeTab === 'purchase' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold', fontSize: 13 }}>
            🛒 {isBN ? 'প্রোডাক্ট ক্রয় / ইনওয়ার্ড' : 'Purchase / Inward'}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'list' ? (
        <>
          <View style={styles.searchContainer}>
            <TextInput
              mode="outlined"
              placeholder={isBN ? 'নাম / SKU / বারকোড দিয়ে খুঁজুন...' : 'Search by name, SKU or barcode...'}
              value={search}
              onChangeText={setSearch}
              left={<TextInput.Icon icon="magnify" />}
              right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('list')} />}
              style={[styles.searchInput, { backgroundColor: theme.colors.surface }]}
            />
            {categories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <Chip 
                  selected={selectedCategory === null} 
                  onPress={() => setSelectedCategory(null)}
                  style={styles.chip}
                >
                  {isBN ? 'সকল' : 'All'}
                </Chip>
                {categories.map(cat => (
                  <Chip 
                    key={cat.id} 
                    selected={selectedCategory === cat.id} 
                    onPress={() => setSelectedCategory(cat.id)}
                    style={styles.chip}
                  >
                    {cat.name}
                  </Chip>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.listContainer}>
            <ScrollView 
              style={styles.scrollView} 
              contentContainerStyle={styles.scrollContent}
              onScroll={onScroll}
              scrollEventThrottle={400}
            >
              {products.map((product, index) => {
                const stockNum = Number(product.current_stock || 0);
                const isOutOfStock = stockNum <= 0;
                const isLowStock = product.is_low_stock || (stockNum > 0 && stockNum <= 5);

                return (
                  <Card key={`${product.id}-${index}`} style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={() => setSelectedProduct(product)}>
                    <Card.Content>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.productName, { color: isOutOfStock ? '#dc2626' : (isDarkMode ? '#f8fafc' : '#1e293b') }]}>
                            {product.name}
                          </Text>
                          <Text style={styles.sku}>{product.sku ? `SKU: ${product.sku}` : (product.barcode ? `Barcode: ${product.barcode}` : '')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {isOutOfStock ? (
                            <Chip textStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} style={{ backgroundColor: '#dc2626', height: 24 }}>
                              {isBN ? 'স্টক নেই' : 'Out of Stock'}
                            </Chip>
                          ) : isLowStock ? (
                            <Chip textStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} style={{ backgroundColor: '#d97706', height: 24 }}>
                              {isBN ? '⚠️ লো স্টক' : '⚠️ Low Stock'}
                            </Chip>
                          ) : (
                            <Chip textStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} style={{ backgroundColor: '#16a34a', height: 24 }}>
                              {isBN ? 'চালু' : 'Active'}
                            </Chip>
                          )}
                          <TouchableOpacity onPress={() => setProductToEdit(product)} style={{ padding: 6 }}>
                            <MaterialCommunityIcons name="pencil" size={18} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmDelete(product)} style={{ padding: 6 }}>
                            <MaterialCommunityIcons name="delete" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Divider style={{ marginVertical: 8 }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'কেনা দাম:' : 'Cost:'}</Text>
                          <Text style={{ fontWeight: '600', fontSize: 13 }}>৳{Number(product.cost_price || 0).toFixed(2)}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'বিক্রি দাম:' : 'Selling:'}</Text>
                          <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#2563eb' }}>৳{Number(product.selling_price || 0).toFixed(2)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'স্টক:' : 'Stock:'}</Text>
                          <View style={{ backgroundColor: isOutOfStock ? '#fee2e2' : (isLowStock ? '#fef3c7' : '#dcfce7'), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 12, color: isOutOfStock ? '#dc2626' : (isLowStock ? '#d97706' : '#16a34a') }}>
                              {product.current_stock}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })}
              {loading && <ActivityIndicator style={styles.loader} color={theme.colors.primary} />}
              {!loading && products.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="package-variant-closed" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
                  <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isBN ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}</Text>
                </View>
              )}
            </ScrollView>
          </View>

          <FAB
            icon="plus"
            color="#fff"
            style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#2563eb' }}
            onPress={() => setProductToEdit({})}
          />
        </>
      ) : (
        /* Purchase / Stock Inward Tab */
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Card style={{ padding: 16, backgroundColor: theme.colors.surface, marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 17, marginBottom: 4 }}>
              {isBN ? 'নতুন প্রোডাক্ট পার্চেজ / ইনওয়ার্ড' : 'Purchase / Inward Stock'}
            </Text>
            <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 12, marginBottom: 14 }}>
              {isBN ? 'স্টক ইনভেন্টরিতে যুক্ত করুন এবং খরচ হিসাব আপডেট করুন।' : 'Add stock to inventory and update purchase ledger.'}
            </Text>

            {/* Product Search */}
            <TextInput
              mode="outlined"
              label={isBN ? 'প্রোডাক্টের নাম বা বারকোড খুঁজুন...' : 'Search Product...'}
              value={purchaseSearch}
              onChangeText={setPurchaseSearch}
              left={<TextInput.Icon icon="magnify" />}
              right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('purchase')} />}
              style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
            />

            {purchaseResults.length > 0 && (
              <View style={{ maxHeight: 180, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 12, backgroundColor: theme.colors.surface }}>
                <ScrollView nestedScrollEnabled>
                  {purchaseResults.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => selectProductForPurchase(p)}
                      style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                    >
                      <Text style={{ fontWeight: 'bold' }}>{p.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{p.sku || p.barcode || ''} | Stock: {p.current_stock}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {!selectedPurchaseProduct && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 10, marginVertical: 10 }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📦</Text>
                <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                  {isBN ? 'স্টক যুক্ত করার জন্য প্রোডাক্ট যোগ করুন।' : 'Add a product above to inward stock.'}
                </Text>
              </View>
            )}

            {selectedPurchaseProduct && (
              <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#16a34a' }}>✓ {selectedPurchaseProduct.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedPurchaseProduct(null)}>
                    <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#cbd5e1' : '#64748b', marginTop: 2 }}>
                  {isBN ? 'বর্তমান স্টক:' : 'Current Stock:'} {selectedPurchaseProduct.current_stock}
                </Text>
              </View>
            )}

            {/* Pricing Panel */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TextInput
                mode="outlined"
                label={isBN ? 'ক্রয় মূল্য (টাকা)' : 'Cost Price (৳)'}
                value={costPrice}
                onChangeText={setCostPrice}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
              <TextInput
                mode="outlined"
                label={isBN ? 'বিক্রয় মূল্য (টাকা)' : 'Selling Price (৳)'}
                value={sellingPrice}
                onChangeText={setSellingPrice}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
            </View>

            {/* Margin Calculation Box */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', padding: 10, borderRadius: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: 'bold' }}>
                {isBN ? 'মার্জিন:' : 'Margin:'} {marginPct}%
              </Text>
              <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>
                {isBN ? 'লাভ:' : 'Profit:'} ৳{profitPerUnit} {isBN ? '/ইউনিট' : '/unit'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TextInput
                mode="outlined"
                label={isBN ? 'ওয়ারেন্টি (মাস)' : 'Warranty (Months)'}
                value={warrantyMonths}
                onChangeText={setWarrantyMonths}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
              <TextInput
                mode="outlined"
                label={isBN ? 'পরিমাণ (ইউনিট) *' : 'Quantity (Units) *'}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
            </View>

            {/* Serial Barcodes Entry for Batch */}
            <Card style={{ marginBottom: 14, padding: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#4f46e5', marginBottom: 8 }}>
                {isBN ? '🔢 প্রতিটি ইউনিটের আলাদা বারকোড স্ক্যান/লিখুন (ঐচ্ছিক):' : '🔢 Add Serial Barcodes per Unit (Optional):'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  mode="outlined"
                  dense
                  placeholder={isBN ? 'বারকোড বা সিরিয়াল লিখুন...' : 'Enter serial barcode...'}
                  value={customBarcodeInput}
                  onChangeText={setCustomBarcodeInput}
                  right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('purchase')} />}
                  onSubmitEditing={() => addPurchaseBarcode(customBarcodeInput)}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <Button mode="contained" compact buttonColor="#4f46e5" onPress={() => addPurchaseBarcode(customBarcodeInput)}>
                  {isBN ? '+ যুক্ত' : '+ Add'}
                </Button>
              </View>

              {purchaseBarcodes.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {purchaseBarcodes.map((code, idx) => (
                    <Chip
                      key={`${code}-${idx}`}
                      onClose={() => removePurchaseBarcode(code)}
                      style={{ backgroundColor: isDarkMode ? '#334155' : '#e0e7ff' }}
                      textStyle={{ fontSize: 11, color: '#3730a3' }}
                    >
                      #{idx + 1}: {code}
                    </Chip>
                  ))}
                </View>
              )}
            </Card>

            <Divider style={{ marginVertical: 12 }} />

            {/* Supplier Selection */}
            <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              {isBN ? 'সরবরাহকারী (Supplier / Vendor)' : 'Supplier / Vendor'}
            </Text>
            <TouchableOpacity
              onPress={() => setSupplierMenuVisible(true)}
              style={{
                borderWidth: 1,
                borderColor: selectedSupplier ? '#16a34a' : '#cbd5e1',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
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

            {/* Summary & Payment (Web Parity) */}
            <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              {/* Subtotal & Total Amount */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{isBN ? 'সাবটোটাল' : 'Subtotal'}</Text>
                <Text style={{ fontSize: 13, color: theme.colors.onSurface }}>৳{totalPurchaseCost}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.onSurface }}>{isBN ? 'মোট মূল্য' : 'Total Amount'}</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2563eb' }}>৳{totalPurchaseCost}</Text>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              {/* Paid to supplier now */}
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                {isBN ? 'সাপ্লায়ারকে এখন পরিশোধ করা হলো' : 'Paid to Supplier Now'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <TextInput
                  mode="outlined"
                  dense
                  label={isBN ? 'টাকা' : 'BDT'}
                  value={paidAmount}
                  onChangeText={setPaidAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setPaidAmount(totalPurchaseCost)}
                  style={{ justifyContent: 'center', borderColor: '#2563eb' }}
                  textColor="#2563eb"
                >
                  {isBN ? 'সম্পূর্ণ পরিশোধ করুন' : 'Pay Full'}
                </Button>
              </View>

              {/* Payment Methods */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PAY_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setPayMethod(m.key)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
                      borderWidth: 1, borderColor: payMethod === m.key ? '#2563eb' : '#ccc',
                      backgroundColor: payMethod === m.key ? '#e0e7ff' : theme.colors.surface
                    }}
                  >
                    <Text style={{ fontSize: 11, color: payMethod === m.key ? '#2563eb' : theme.colors.onSurface, fontWeight: payMethod === m.key ? 'bold' : 'normal' }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Due After Payment */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                  {isBN ? 'পরিশোধের পর সাপ্লায়ারের বকেয়া' : 'Supplier Due After Payment'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: Number(totalPurchaseCost) - (Number(paidAmount) || 0) > 0 ? '#ea580c' : '#16a34a' }}>
                  ৳{Math.max(0, Number(totalPurchaseCost) - (Number(paidAmount) || 0)).toFixed(2)}
                </Text>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              {/* Purchase Summary: Vendor Selection */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: theme.colors.onSurface }}>
                {isBN ? 'পার্চেজ সামারি' : 'Purchase Summary'}
              </Text>
              <View style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                    {isBN ? 'ভেন্ডর' : 'Vendor'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddVendorModal(true)}>
                    <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: 'bold' }}>+ {isBN ? 'যোগ করুন' : 'add'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setSupplierMenuVisible(true)}
                  style={{
                    borderWidth: 1,
                    borderColor: selectedSupplier ? '#16a34a' : '#cbd5e1',
                    borderRadius: 8,
                    padding: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: theme.colors.surface
                  }}
                >
                  <Text style={{ fontSize: 13, color: selectedSupplier ? '#16a34a' : '#64748b', fontWeight: selectedSupplier ? 'bold' : 'normal' }}>
                    {selectedSupplier ? `✓ ${selectedSupplier.name}` : '— none —'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              mode="contained"
              buttonColor="#2563eb"
              icon="arrow-up-bold-box"
              loading={pushingToStock}
              disabled={pushingToStock || !selectedPurchaseProduct || qtyNum <= 0}
              onPress={handlePushToStock}
              style={{ paddingVertical: 6, borderRadius: 8 }}
            >
              {isBN ? '↑ স্টকে যুক্ত করুন (Push to Stock)' : '↑ Push to Stock'}
            </Button>
            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
              ⓘ {isBN ? 'লেজার এবং ইনভেন্টরি লেভেল আপডেট হবে' : 'Updates ledger & inventory levels'}
            </Text>
          </Card>
        </ScrollView>
      )}

      {/* Quick Add Vendor Modal */}
      <Modal visible={showAddVendorModal} transparent animationType="fade" onRequestClose={() => setShowAddVendorModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 400, padding: 16, backgroundColor: theme.colors.surface }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: '#2563eb' }}>
              {isBN ? '✨ নতুন সরবরাহকারী / ভেন্ডর যোগ করুন' : '✨ Quick Add Vendor'}
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
              <Button disabled={savingVendor} onPress={() => setShowAddVendorModal(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
              <Button mode="contained" buttonColor="#16a34a" loading={savingVendor} disabled={savingVendor} onPress={handleCreateVendor}>
                {isBN ? 'যোগ করুন' : 'Add Vendor'}
              </Button>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Product Detail Modal */}
      <ProductDetailModal 
        visible={!!selectedProduct} 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />

      {/* Add / Edit Product Modal */}
      <EditProductModal 
        visible={!!productToEdit} 
        product={productToEdit} 
        onClose={() => setProductToEdit(null)} 
        onSaved={() => {
          setProductToEdit(null);
          fetchProducts(1, debouncedSearch, selectedCategory, true);
        }}
      />

      {/* Supplier Selector Modal */}
      <Modal visible={supplierMenuVisible} transparent animationType="fade" onRequestClose={() => setSupplierMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setSupplierMenuVisible(false)}>
          <Card style={{ width: '100%', maxWidth: 420, maxHeight: '80%', padding: 16, backgroundColor: theme.colors.surface }} onPress={e => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a' }}>
                {isBN ? 'সরবরাহকারী / ভেন্ডর নির্বাচন করুন' : 'Select Supplier / Vendor'}
              </Text>
              <TouchableOpacity onPress={() => setSupplierMenuVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                onPress={() => { setSelectedSupplier(null); setSupplierMenuVisible(false); }}
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

              {suppliers.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => { setSelectedSupplier(s); setSupplierMenuVisible(false); }}
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

              {suppliers.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#64748b', padding: 16 }}>
                  {isBN ? 'কোনো সরবরাহকারী পাওয়া যায়নি।' : 'No suppliers found.'}
                </Text>
              )}
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </Modal>

      <CameraBarcodeScannerModal
        visible={!!scannerTarget}
        onClose={() => setScannerTarget(null)}
        onScanned={(code) => {
          if (scannerTarget === 'list') {
            setSearch(code);
          } else if (scannerTarget === 'purchase') {
            setPurchaseSearch(code);
          }
          setScannerTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: 'transparent' },
  searchInput: { marginBottom: 8 },
  chipScroll: { flexDirection: 'row', paddingBottom: 4 },
  chip: { marginRight: 8 },
  listContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 10, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontWeight: 'bold', fontSize: 15 },
  sku: { color: '#888', fontSize: 12, marginTop: 2 },
  loader: { marginVertical: 20 }
});
