import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, Platform, KeyboardAvoidingView
} from 'react-native';
import { Text, useTheme, Surface, TextInput, Button, Chip, Divider, Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import Skeleton from '../components/Skeleton';
import ProductDetailModal from '../components/ProductDetailModal';
import EditProductModal from '../components/EditProductModal';

type InvSummary = {
  stock_value: number;
  by_category: { category__name: string | null; units: number; value: number }[];
  low_stock: { id: number; name: string; sku: string; current_stock: string; reorder_level: string }[];
  out_of_stock: { id: number; name: string; sku: string; current_stock: string }[];
};

type Movement = {
  id: number; product_name: string; movement_type: string;
  quantity: string; note: string; created_at: string;
};

type FullProduct = {
  id: number; name: string; sku: string; selling_price: string; cost_price: string;
  current_stock: string; reorder_level?: string; is_low_stock?: boolean;
  is_active?: boolean; category?: number | null; category_name?: string;
};

type AdjProduct = { id: number; name: string; };

export default function InventoryScreen() {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InvSummary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<FullProduct[]>([]);
  const [adjProducts, setAdjProducts] = useState<AdjProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Expand state for cards
  const [expandedCard, setExpandedCard] = useState<'lowstock' | 'outofstock' | 'categories' | null>(null);
  const [lowStockLimit, setLowStockLimit] = useState(15);
  const [outOfStockLimit, setOutOfStockLimit] = useState(15);
  
  const [selectedProduct, setSelectedProduct] = useState<FullProduct | null>(null);
  const [productToEdit, setProductToEdit] = useState<FullProduct | null>(null);

  const [productToDelete, setProductToDelete] = useState<FullProduct | null>(null);

  const confirmDelete = (p: FullProduct) => {
    setProductToDelete(p);
  };

  const deleteProduct = async (id: number) => {
    try {
      await api.delete(`/catalog/products/${id}/`);
      setProducts(prev => prev.filter(p => p.id !== id));
      loadSummary();
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.response?.data?.error || e.message || (isBN ? 'পণ্যটি ডিলিট করা যায়নি।' : 'Failed to delete product');
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', msg);
    }
  };

  // Product list filter
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(true);

  // Adjustment form
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjProduct, setAdjProduct] = useState<AdjProduct | null>(null);
  const [adjSearch, setAdjSearch] = useState('');
  const [showAdjDropdown, setShowAdjDropdown] = useState(false);
  const [adjType, setAdjType] = useState('adjust_in');
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [saving, setSaving] = useState(false);

  const ADJ_TYPES = [
    { value: 'adjust_in', label: isBN ? 'অ্যাডজাস্ট ইন' : 'Adjust In', color: '#10b981', icon: 'plus-circle' },
    { value: 'adjust_out', label: isBN ? 'অ্যাডজাস্ট আউট' : 'Adjust Out', color: '#f59e0b', icon: 'minus-circle' },
    { value: 'damage', label: isBN ? 'ড্যামেজ' : 'Damage', color: '#ef4444', icon: 'alert-circle' },
    { value: 'opening', label: isBN ? 'ওপেনিং' : 'Opening', color: '#6366f1', icon: 'archive' },
  ];

  const movBadgeColor: Record<string, string> = {
    adjust_in: '#10b981', adjust_out: '#f59e0b', sale: '#3b82f6',
    purchase: '#6366f1', damage: '#ef4444', opening: '#8b5cf6', loss: '#dc2626', return: '#0891b2',
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [sumRes, movRes, adjProdRes] = await Promise.all([
        api.get('/analytics/inventory/'),
        api.get('/inventory/stock-movements/?page=1&page_size=25'),
        api.get('/catalog/products/?light=1&page_size=200'),
      ]);
      setSummary(sumRes.data);
      setMovements(movRes.data?.results || []);
      setAdjProducts(adjProdRes.data?.results || adjProdRes.data || []);
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchSeqRef = useRef(0);

  const loadProducts = useCallback(async (page = 1, search = '') => {
    const seq = ++searchSeqRef.current;
    setProductsLoading(true);
    try {
      const res = await api.get('/catalog/products/', { params: { page, page_size: 20, search, light: 1 } });
      if (seq !== searchSeqRef.current) return;
      const results: FullProduct[] = res.data?.results || [];
      if (page === 1) {
        setProducts(results);
      } else {
        setProducts(prev => [...prev, ...results]);
      }
      setProductHasMore(!!res.data?.next);
      setProductPage(page);
    } catch {}
    if (seq === searchSeqRef.current) {
      setProductsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
      loadProducts(1, productSearch);
    }, [productSearch])
  );

  const handleSearch = (text: string) => {
    setProductSearch(text);
    loadProducts(1, text);
  };

  const handleAdjustSubmit = async () => {
    if (!adjProduct || !adjQty) return;
    setSaving(true);
    try {
      await api.post('/inventory/stock-movements/adjust/', {
        product: adjProduct.id,
        movement_type: adjType,
        quantity: parseInt(adjQty, 10),
        note: adjNote,
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'স্টক আপডেট হয়েছে' : 'Stock adjusted successfully');
      setShowAdjForm(false);
      setAdjProduct(null); setAdjSearch(''); setAdjQty(''); setAdjNote(''); setAdjType('adjust_in');
      loadSummary();
      loadProducts(1, productSearch);
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAdjProducts = adjProducts.filter(p =>
    p.name.toLowerCase().includes(adjSearch.toLowerCase())
  );

  const SummaryCard = ({ title, value, icon, color, cardKey, subtitle }: any) => {
    const isExpanded = expandedCard === cardKey;
    return (
      <TouchableOpacity
        style={{ flex: 1, margin: 4 }}
        onPress={() => setExpandedCard(isExpanded ? null : cardKey)}
        activeOpacity={0.8}
      >
        <Surface style={{
          borderRadius: 16, padding: 16,
          backgroundColor: theme.colors.surface,
          elevation: 3, borderWidth: isExpanded ? 2 : 0,
          borderColor: color,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12, marginBottom: 4 }}>{title}</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color }}>{value}</Text>
              {subtitle && <Text style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 2 }}>{subtitle}</Text>}
            </View>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center',
            }}>
              <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
          </View>
          {cardKey && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: color, fontWeight: 'bold' }}>{isExpanded ? (isBN ? 'মিনিমাইজ' : 'Hide Details') : (isBN ? 'বিস্তারিত দেখুন' : 'View Details')}</Text>
            <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={color} />
          </View>}
        </Surface>
      </TouchableOpacity>
    );
  };

  const getStockBg = (item: FullProduct) => {
    if (Number(item.current_stock) <= 0) return isDarkMode ? '#2d1515' : '#fef2f2';
    if (item.is_low_stock) return isDarkMode ? '#2d2006' : '#fffbeb';
    return theme.colors.surface;
  };
  const getStockColor = (item: FullProduct) => {
    if (Number(item.current_stock) <= 0) return '#ef4444';
    if (item.is_low_stock) return '#f59e0b';
    return '#10b981';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} elevated>
        <Appbar.Content title={isBN ? 'ইনভেন্টরি' : 'Inventory'} titleStyle={{ fontWeight: 'bold' }} />
        <Appbar.Action icon="refresh" onPress={() => { loadSummary(); loadProducts(1, productSearch); }} />
        <Appbar.Action icon="plus-circle" onPress={() => setShowAdjForm(true)} color={theme.colors.primary} />
      </Appbar.Header>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Summary Cards */}
        {loading ? (
          <View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Skeleton style={{ flex: 1, height: 90, margin: 4, borderRadius: 16 }} isDark={isDarkMode} />
              <Skeleton style={{ flex: 1, height: 90, margin: 4, borderRadius: 16 }} isDark={isDarkMode} />
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Skeleton style={{ flex: 1, height: 90, margin: 4, borderRadius: 16 }} isDark={isDarkMode} />
              <Skeleton style={{ flex: 1, height: 90, margin: 4, borderRadius: 16 }} isDark={isDarkMode} />
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <SummaryCard
                title={isBN ? 'স্টক ভ্যালু' : 'Stock Value'}
                value={`৳${Number(summary?.stock_value || 0).toLocaleString()}`}
                icon="currency-bdt"
                color="#4338ca"
                cardKey={null}
              />
              <SummaryCard
                title={isBN ? 'ক্যাটাগরি' : 'Categories'}
                value={summary?.by_category?.length || 0}
                icon="tag-multiple"
                color="#0891b2"
                cardKey="categories"
                subtitle={isBN ? 'ক্লিক করুন' : 'tap to expand'}
              />
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <SummaryCard
                title={isBN ? 'লো স্টক' : 'Low Stock'}
                value={summary?.low_stock?.length || 0}
                icon="alert"
                color="#f59e0b"
                cardKey="lowstock"
                subtitle={isBN ? 'পণ্য দেখতে ট্যাপ করুন' : 'tap to see products'}
              />
              <SummaryCard
                title={isBN ? 'আউট অফ স্টক' : 'Out of Stock'}
                value={summary?.out_of_stock?.length || 0}
                icon="package-variant-remove"
                color="#ef4444"
                cardKey="outofstock"
                subtitle={isBN ? 'পণ্য দেখতে ট্যাপ করুন' : 'tap to see products'}
              />
            </View>

            {/* Categories Expansion */}
            {expandedCard === 'categories' && summary?.by_category && (
              <Surface style={{ borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 4, backgroundColor: theme.colors.surface, elevation: 2 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 15, color: theme.colors.onSurface }}>{isBN ? 'ক্যাটাগরি বিভাজন' : 'Category Breakdown'}</Text>
                {summary.by_category.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', marginRight: 10 }} />
                      <Text style={{ fontWeight: '500', color: theme.colors.onSurface }}>{c.category__name || (isBN ? 'আনক্যাটাগরাইজড' : 'Uncategorized')}</Text>
                    </View>
                    <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>{c.units} {isBN ? 'পিস' : 'units'}</Text>
                    <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#818cf8' : '#4338ca', marginLeft: 12 }}>৳{Number(c.value).toLocaleString()}</Text>
                  </View>
                ))}
              </Surface>
            )}

            {/* Low Stock Expansion */}
            {expandedCard === 'lowstock' && summary?.low_stock && (
              <Surface style={{ borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 4, backgroundColor: theme.colors.surface, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons name="alert" size={18} color="#f59e0b" style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#f59e0b' }}>{isBN ? 'লো স্টক পণ্য' : 'Low Stock Products'}</Text>
                </View>
                {summary.low_stock.slice(0, lowStockLimit).map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setSelectedProduct(p as any)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#fffbeb' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: isDarkMode ? '#fde68a' : '#92400e', fontSize: 13 }}>{p.name}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 11 }}>{p.sku}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: 16 }}>{p.current_stock}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 11 }}>Reorder: {p.reorder_level}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {summary.low_stock.length > lowStockLimit && (
                  <Button mode="text" onPress={() => setLowStockLimit(prev => prev + 15)}>
                    {isBN ? 'আরও দেখুন' : 'Show More'}
                  </Button>
                )}
                {summary.low_stock.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{isBN ? 'কোনো লো স্টক নেই' : 'No low stock items'}</Text>}
              </Surface>
            )}

            {/* Out of Stock Expansion */}
            {expandedCard === 'outofstock' && summary?.out_of_stock && (
              <Surface style={{ borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 4, backgroundColor: theme.colors.surface, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons name="package-variant-remove" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#ef4444' }}>{isBN ? 'আউট অফ স্টক পণ্য' : 'Out of Stock Products'}</Text>
                </View>
                {summary.out_of_stock.slice(0, outOfStockLimit).map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setSelectedProduct(p as any)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#fef2f2' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: isDarkMode ? '#fca5a5' : '#991b1b', fontSize: 13 }}>{p.name}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 11 }}>{p.sku}</Text>
                    </View>
                    <View style={{ backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>0</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {summary.out_of_stock.length > outOfStockLimit && (
                  <Button mode="text" onPress={() => setOutOfStockLimit(prev => prev + 15)}>
                    {isBN ? 'আরও দেখুন' : 'Show More'}
                  </Button>
                )}
                {summary.out_of_stock.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{isBN ? 'সব পণ্যে স্টক আছে' : 'All products in stock'}</Text>}
              </Surface>
            )}
          </>
        )}

        {/* Product List */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: theme.colors.onSurface }}>{isBN ? 'সব পণ্য' : 'All Products'}</Text>
          <TextInput
            mode="outlined"
            placeholder={isBN ? 'পণ্য খুঁজুন...' : 'Search products...'}
            value={productSearch}
            onChangeText={handleSearch}
            left={<TextInput.Icon icon="magnify" />}
            right={productSearch ? <TextInput.Icon icon="close" onPress={() => handleSearch('')} /> : null}
            style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
            outlineStyle={{ borderRadius: 12 }}
          />
          {productsLoading && productPage === 1 ? (
            [1,2,3,4].map(i => <Skeleton key={i} style={{ height: 70, borderRadius: 12, marginBottom: 8 }} isDark={isDarkMode} />)
          ) : (
            <>
              {products.map((item, idx) => (
                <View key={item.id}>
                  <Surface style={{
                    borderRadius: 12, padding: 14, marginBottom: 8,
                    backgroundColor: getStockBg(item),
                    elevation: 1,
                  }}>
                  {/* Row 1: Name + Status Badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <TouchableOpacity style={{ flex: 1, marginRight: 8 }} onPress={() => setSelectedProduct(item)}>
                      <Text style={{ fontWeight: '700', fontSize: 14, color: isDarkMode ? '#f8fafc' : '#1e293b' }} numberOfLines={2}>{item.name}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2, fontFamily: 'monospace' }}>{item.sku}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => setProductToEdit(item)} style={{ padding: 4, marginRight: 8 }}>
                        <MaterialCommunityIcons name="pencil" size={20} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(item)} style={{ padding: 4, marginRight: 8 }}>
                        <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                      </TouchableOpacity>
                      {Number(item.current_stock || 0) <= 0 ? (
                        <View style={{ backgroundColor: isDarkMode ? '#450a0a' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                          <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: 'bold' }}>
                            {isBN ? 'নিষ্ক্রিয় (স্টক ০)' : 'Deactive (0 Stock)'}
                          </Text>
                        </View>
                      ) : item.is_active === false ? (
                        <View style={{ backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 'bold' }}>
                            {isBN ? 'বন্ধ' : 'Inactive'}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: isDarkMode ? '#064e3b' : '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                          <Text style={{ color: isDarkMode ? '#4ade80' : '#16a34a', fontSize: 11, fontWeight: 'bold' }}>
                            {isBN ? 'চালু' : 'Active'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {/* Row 2: Cost | Selling | Stock */}
                  <TouchableOpacity onPress={() => setSelectedProduct(item)}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9', paddingTop: 8 }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10, marginBottom: 2 }}>{isBN ? 'ক্রয় মূল্য' : 'Cost'}</Text>
                        <Text style={{ fontWeight: '600', fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#475569' }}>৳{Number(item.cost_price).toLocaleString()}</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10, marginBottom: 2 }}>{isBN ? 'বিক্রয় মূল্য' : 'Selling'}</Text>
                        <Text style={{ fontWeight: '600', fontSize: 13, color: isDarkMode ? '#60a5fa' : '#3b82f6' }}>৳{Number(item.selling_price).toLocaleString()}</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10, marginBottom: 2 }}>{isBN ? 'স্টক' : 'Stock'}</Text>
                        <Text style={{ fontWeight: '600', fontSize: 13, color: getStockColor(item) }}>{Number(item.current_stock).toFixed(0)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  </Surface>
                </View>
              ))}
              {productHasMore && (
                <Button mode="outlined" onPress={() => loadProducts(productPage + 1, productSearch)} loading={productsLoading} style={{ marginTop: 8, borderRadius: 12 }}>
                  {isBN ? 'আরও লোড করুন' : 'Load More'}
                </Button>
              )}
              {products.length === 0 && !productsLoading && (
                <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>{isBN ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}</Text>
              )}
            </>
          )}
        </View>

        {/* Stock Movements */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>{isBN ? 'স্টক মুভমেন্টস' : 'Stock Movements'}</Text>
          {movements.map(m => (
            <Surface key={m.id} style={{ borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{m.product_name}</Text>
                  {m.note ? <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{m.note}</Text> : null}
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{new Date(m.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ backgroundColor: (movBadgeColor[m.movement_type] || '#64748b') + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                    <Text style={{ color: movBadgeColor[m.movement_type] || '#64748b', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>{m.movement_type.replace('_',' ')}</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', marginTop: 4, color: m.movement_type.includes('in') || m.movement_type === 'opening' ? '#10b981' : '#ef4444' }}>
                    {m.movement_type.includes('in') || m.movement_type === 'opening' ? '+' : '-'}{m.quantity}
                  </Text>
                </View>
              </View>
            </Surface>
          ))}
        </View>
      </ScrollView>

      {/* Stock Adjustment Modal */}
      <Modal visible={showAdjForm} transparent animationType="slide" onRequestClose={() => setShowAdjForm(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowAdjForm(false)} />
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 500, maxHeight: '85%' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{isBN ? 'স্টক অ্যাডজাস্টমেন্ট' : 'Stock Adjustment'}</Text>
              <TouchableOpacity onPress={() => setShowAdjForm(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Product Picker */}
              <Text style={{ fontWeight: '600', marginBottom: 6, color: '#64748b' }}>{isBN ? 'পণ্য নির্বাচন' : 'Select Product'}</Text>
              <TextInput
                mode="outlined"
                placeholder={isBN ? 'পণ্য খুঁজুন...' : 'Search product...'}
                value={adjSearch}
                onChangeText={t => { setAdjSearch(t); setShowAdjDropdown(true); }}
                onFocus={() => setShowAdjDropdown(true)}
                left={<TextInput.Icon icon="magnify" />}
                style={{ marginBottom: 4, backgroundColor: theme.colors.surface }}
                outlineStyle={{ borderRadius: 12 }}
              />
              {adjProduct && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', padding: 10, borderRadius: 10, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#4338ca" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#4338ca', fontWeight: '600', flex: 1 }}>{adjProduct.name}</Text>
                  <TouchableOpacity onPress={() => { setAdjProduct(null); setAdjSearch(''); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#4338ca" />
                  </TouchableOpacity>
                </View>
              )}
              {showAdjDropdown && !adjProduct && adjSearch.length > 0 && (
                <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 180, marginBottom: 8, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredAdjProducts.slice(0, 15).map(p => (
                      <TouchableOpacity key={p.id} onPress={() => { setAdjProduct(p); setAdjSearch(p.name); setShowAdjDropdown(false); }}
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {filteredAdjProducts.length === 0 && <Text style={{ padding: 12, color: '#94a3b8', textAlign: 'center' }}>{isBN ? 'পাওয়া যায়নি' : 'Not found'}</Text>}
                  </ScrollView>
                </View>
              )}

              {/* Movement Type */}
              <Text style={{ fontWeight: '600', marginBottom: 8, color: '#64748b', marginTop: 4 }}>{isBN ? 'ধরণ' : 'Type'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {ADJ_TYPES.map(type => (
                  <TouchableOpacity key={type.value} onPress={() => setAdjType(type.value)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: adjType === type.value ? type.color : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      borderWidth: 1, borderColor: adjType === type.value ? type.color : 'transparent' }}>
                    <MaterialCommunityIcons name={type.icon as any} size={14} color={adjType === type.value ? '#fff' : '#64748b'} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: adjType === type.value ? '#fff' : '#64748b' }}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput mode="outlined" label={isBN ? 'পরিমাণ' : 'Quantity'} keyboardType="numeric" value={adjQty} onChangeText={setAdjQty}
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} outlineStyle={{ borderRadius: 12 }} />
              <TextInput mode="outlined" label={isBN ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'} value={adjNote} onChangeText={setAdjNote}
                style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} outlineStyle={{ borderRadius: 12 }} />

              <Button mode="contained" onPress={handleAdjustSubmit} loading={saving} disabled={saving || !adjProduct || !adjQty}
                style={{ borderRadius: 12 }} contentStyle={{ height: 50 }}>
                {isBN ? 'সেভ করুন' : 'Save Adjustment'}
              </Button>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ProductDetailModal 
        visible={!!selectedProduct} 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
      <EditProductModal
        visible={!!productToEdit}
        product={productToEdit}
        onClose={() => setProductToEdit(null)}
        onSaved={() => {
          setProductToEdit(null);
          loadProducts(1, productSearch);
          loadSummary();
        }}
      />

      <Modal visible={!!productToDelete} transparent animationType="fade" onRequestClose={() => setProductToDelete(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Surface style={{ width: '100%', maxWidth: 400, borderRadius: 16, padding: 24, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#fef2f2', padding: 16, borderRadius: 50, marginBottom: 16 }}>
                <MaterialCommunityIcons name="alert" size={32} color="#ef4444" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                {isBN ? 'নিশ্চিত করুন' : 'Confirm Delete'}
              </Text>
              <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                {isBN ? `${productToDelete?.name} ডিলিট করতে চান? এই প্রক্রিয়াটি পরিবর্তনযোগ্য নয়।` : `Are you sure you want to delete ${productToDelete?.name}? This action cannot be undone.`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button mode="outlined" onPress={() => setProductToDelete(null)} style={{ flex: 1, borderRadius: 8 }} textColor="#64748b">
                {isBN ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button 
                mode="contained" 
                buttonColor="#ef4444" 
                onPress={() => {
                  if (productToDelete) deleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }} 
                style={{ flex: 1, borderRadius: 8 }}
              >
                {isBN ? 'ডিলিট' : 'Delete'}
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>

    </View>
  );
}
