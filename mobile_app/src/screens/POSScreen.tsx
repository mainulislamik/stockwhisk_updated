import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, FlatList, Alert, Modal, Dimensions, Linking, Platform, BackHandler, Keyboard } from 'react-native';
import { Text, Appbar, useTheme, Surface, IconButton, TextInput, Button, Divider, ActivityIndicator, Badge, Chip, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

type ProductUnit = { id: number; barcode: string; effective_selling_price?: string; effective_cost_price?: string; effective_warranty_months?: number };
type Product = {
  id: number; name: string; sku: string; barcode?: string;
  selling_price: string; cost_price: string; current_stock: string; track_inventory?: boolean;
  warranty_months?: number; is_low_stock?: boolean; image?: string;
  units?: ProductUnit[];
  scanned_unit?: ProductUnit;
};
type CartLine = { product: Product; qty: number; price: number; discount: number; selectedUnits: ProductUnit[] };
type Customer = { id: number; name: string; phone?: string; };

export default function POSScreen() {
  const route = useRoute<any>();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  const t = (bn: string, en: string) => isBN ? bn : en;

  const [view, setView] = useState<'products' | 'cart'>('products');
  const [cart, setCart] = useState<CartLine[]>([]);

  // Product Browser State
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Camera Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Unit Modal
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [selectedProductForUnit, setSelectedProductForUnit] = useState<Product | null>(null);
  const [tempSelectedUnits, setTempSelectedUnits] = useState<ProductUnit[]>([]);
  const [fetchingUnits, setFetchingUnits] = useState(false);
  const [modalQty, setModalQty] = useState('1');
  const [modalPrice, setModalPrice] = useState('');
  const [modalDiscount, setModalDiscount] = useState('0');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  // Cart / Checkout State
  const [customerQuery, setCustomerQuery] = useState('');
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [customerSearchFocused, setCustomerSearchFocused] = useState(false);
  const [walkPhone, setWalkPhone] = useState('');
  const [walkName, setWalkName] = useState('');
  const [walkEmail, setWalkEmail] = useState('');
  const [walkAddress, setWalkAddress] = useState('');
  const [matchedId, setMatchedId] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'card' | 'nagad' | 'bank_transfer'>('cash');
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Missing web features
  const { user, loadUser } = useAuth();
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [isEmi, setIsEmi] = useState(false);
  const [emiMonths, setEmiMonths] = useState(3);
  const [emiInterestPercent, setEmiInterestPercent] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [existingEmail, setExistingEmail] = useState('');
  const [saleResult, setSaleResult] = useState<{ id: number; invoice_no: string; phone: string; name: string; total: number; pdfUrl: string } | null>(null);

  // Custom Ad-hoc Item State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');

  const handleAddCustomItem = () => {
    Keyboard.dismiss();
    if (!customItemName.trim() || !customItemPrice) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'পণ্যের নাম ও বিক্রয় মূল্য দিন।' : 'Please enter item name and price.');
      return;
    }
    const priceNum = parseFloat(customItemPrice);
    const qtyNum = parseFloat(customItemQty) || 1;
    if (isNaN(priceNum) || priceNum < 0 || isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'সঠিক মূল্য ও পরিমাণ লিখুন।' : 'Please enter valid price and quantity.');
      return;
    }
    const customProduct: Product = {
      id: -Date.now(),
      name: customItemName.trim(),
      sku: 'CUSTOM',
      selling_price: String(priceNum),
      cost_price: '0',
      current_stock: '999',
      track_inventory: false,
    };
    setCart(prev => [...prev, { product: customProduct, qty: qtyNum, price: priceNum, discount: 0, selectedUnits: [] }]);
    setShowCustomItemModal(false);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty('1');
    if (view !== 'cart') setView('cart');
  };

  // Refresh user settings every time this screen becomes visible
  // so that changes made in Settings (EMI, Delivery, etc.) are immediately reflected
  useFocusEffect(
    useCallback(() => {
      loadUser();
      const onBackPress = () => {
        if (view === 'cart') {
          setView('products');
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [view])
  );

  const CART_DRAFT_KEY = `stockwhisk_pos_cart_draft_${user?.id || 'default'}`;

  // Load draft cart on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        if (Platform.OS === 'web') {
          const saved = localStorage.getItem(CART_DRAFT_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
          }
        } else {
          const saved = await SecureStore.getItemAsync(CART_DRAFT_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
          }
        }
      } catch {}
    };
    loadDraft();
  }, [user?.id]);

  // Handle scanned barcode from external screens (e.g. Dashboard)
  useEffect(() => {
    if (route.params?.scannedBarcode) {
      const code = String(route.params.scannedBarcode).trim();
      if (code) {
        processBarcode(code);
      }
    }
  }, [route.params?.scannedBarcode]);

  // Save draft cart on change
  useEffect(() => {
    const saveDraft = async () => {
      try {
        if (cart.length > 0) {
          const data = JSON.stringify(cart);
          if (Platform.OS === 'web') localStorage.setItem(CART_DRAFT_KEY, data);
          else await SecureStore.setItemAsync(CART_DRAFT_KEY, data);
        } else {
          if (Platform.OS === 'web') localStorage.removeItem(CART_DRAFT_KEY);
          else await SecureStore.deleteItemAsync(CART_DRAFT_KEY);
        }
      } catch {}
    };
    saveDraft();
  }, [cart, user?.id]);

  useEffect(() => {
    if (customerMode === "existing" && selectedCustomer) {
      setExistingEmail((selectedCustomer as any).email || "");
    }
  }, [customerMode, selectedCustomer]);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerQuery(customerQuery), 400);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const fetchProducts = async (pageNum: number, reset: boolean) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const res = await api.get('/catalog/products/', {
        params: { search: debouncedQuery, page: pageNum, page_size: 20, in_stock: 1, light: 1 }
      });
      const data = res.data.results || [];
      if (reset) {
        setProducts(data);
      } else {
        setProducts(prev => [...prev, ...data]);
      }
      setPage(pageNum);
      setHasMore(!!res.data.next);
    } catch (e) {
      console.log('Error fetching products', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, true);
  }, [debouncedQuery]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchProducts(page + 1, false);
    }
  };

  useEffect(() => {
    api.get('/crm/customers/', { params: { search: debouncedCustomerQuery, page_size: 20 } })
      .then((res: any) => setCustomerResults(res.data.results || []))
      .catch((e: any) => console.log('Error fetching customers', e));
  }, [debouncedCustomerQuery]);

  const handleProductTap = async (product: Product) => {
    if (product.track_inventory !== false && Number(product.current_stock) <= 0) {
      Alert.alert(t('স্টক নেই', 'Out of Stock'), t('এই পণ্যের স্টক শেষ।', 'This product is out of stock.'));
      return;
    }

    setFetchingUnits(true);
    try {
      const res = await api.get(`/catalog/products/${product.id}/`);
      const fullProduct = res.data || product;
      setSelectedProductForUnit(fullProduct);
      setUnitSearchQuery('');
      const existingLine = cart.find(l => l.product.id === fullProduct.id);
      if (existingLine) {
        setTempSelectedUnits(existingLine.selectedUnits || []);
        setModalQty(String(existingLine.qty || 1));
        setModalPrice(String(existingLine.price !== undefined ? existingLine.price : fullProduct.selling_price));
        setModalDiscount(String(existingLine.discount || 0));
      } else {
        setTempSelectedUnits([]);
        setModalQty('1');
        setModalPrice(String(fullProduct.selling_price || '0'));
        setModalDiscount('0');
      }
      setUnitModalVisible(true);
    } catch (e) {
      console.log('Error fetching full product', e);
      setSelectedProductForUnit(product);
      setUnitSearchQuery('');
      const existingLine = cart.find(l => l.product.id === product.id);
      if (existingLine) {
        setTempSelectedUnits(existingLine.selectedUnits || []);
        setModalQty(String(existingLine.qty || 1));
        setModalPrice(String(existingLine.price !== undefined ? existingLine.price : product.selling_price));
        setModalDiscount(String(existingLine.discount || 0));
      } else {
        setTempSelectedUnits([]);
        setModalQty('1');
        setModalPrice(String(product.selling_price || '0'));
        setModalDiscount('0');
      }
      setUnitModalVisible(true);
    } finally {
      setFetchingUnits(false);
    }
  };

  const toggleUnitSelection = (unit: ProductUnit) => {
    setTempSelectedUnits(prev => {
      const exists = prev.find(u => u.id === unit.id);
      if (exists) return prev.filter(u => u.id !== unit.id);
      return [...prev, unit];
    });
  };

  const confirmUnitSelection = () => {
    if (!selectedProductForUnit) return;
    
    const hasUnits = Array.isArray(selectedProductForUnit.units) && selectedProductForUnit.units.length > 0;
    const priceNum = parseFloat(modalPrice) || Number(selectedProductForUnit.selling_price) || 0;
    const discountNum = parseFloat(modalDiscount) || 0;
    
    let finalQty = 1;
    if (hasUnits) {
      finalQty = tempSelectedUnits.length;
      if (finalQty === 0) {
        Alert.alert(
          isBN ? 'সতর্কতা' : 'Warning',
          isBN ? 'অনুগ্রহ করে কমপক্ষে ১টি ইউনিট বা বারকোড নির্বাচন করুন।' : 'Please select at least 1 unit or barcode.'
        );
        return;
      }
    } else {
      finalQty = parseFloat(modalQty) || 1;
      if (finalQty <= 0) {
        Alert.alert(
          isBN ? 'সতর্কতা' : 'Warning',
          isBN ? 'কমপক্ষে ১টি পরিমাণ নির্বাচন করুন।' : 'Please enter a quantity of at least 1.'
        );
        return;
      }
    }

    setCart(prev => {
      const idx = prev.findIndex(l => l.product.id === selectedProductForUnit.id);
      const newLine: CartLine = {
        product: selectedProductForUnit,
        qty: finalQty,
        price: priceNum,
        discount: discountNum,
        selectedUnits: hasUnits ? tempSelectedUnits : [],
      };
      if (idx >= 0) {
        const nextCart = [...prev];
        nextCart[idx] = newLine;
        return nextCart;
      } else {
        return [...prev, newLine];
      }
    });

    setUnitModalVisible(false);
    setSelectedProductForUnit(null);
    setTempSelectedUnits([]);
  };

  const addToCart = (product: Product, units: ProductUnit[], qty: number = 1) => {
    setCart(prev => {
      const idx = prev.findIndex(l => l.product.id === product.id);
      if (idx >= 0) {
        const newLine = { ...prev[idx] };
        if (units.length > 0) {
           newLine.selectedUnits = units;
           newLine.qty = units.length;
        } else {
           newLine.qty += qty;
        }
        
        if (newLine.qty === 0) return prev.filter(l => l.product.id !== product.id);
        
        const nextCart = [...prev];
        nextCart[idx] = newLine;
        return nextCart;
      } else {
        if (qty === 0) return prev;
        return [...prev, {
          product,
          qty,
          price: Number(product.selling_price),
          discount: 0,
          selectedUnits: units
        }];
      }
    });
  };

  const updateCartQty = (id: number, delta: number) => {
    const line = cart.find(l => l.product.id === id);
    if (!line) return;

    if (line.selectedUnits && line.selectedUnits.length > 0) {
      if (delta > 0) {
        handleProductTap(line.product);
        return;
      } else {
        const nextUnits = line.selectedUnits.slice(0, -1);
        if (nextUnits.length === 0) {
          removeLine(id);
        } else {
          addToCart(line.product, nextUnits, nextUnits.length);
        }
        return;
      }
    }

    setCart(prev => prev.map(l => {
      if (l.product.id === id) {
        const nextQty = l.qty + delta;
        return nextQty <= 0 ? null : { ...l, qty: nextQty };
      }
      return l;
    }).filter(Boolean) as CartLine[]);
  };

  const removeLine = (id: number) => {
    setCart(prev => prev.filter(l => l.product.id !== id));
  };

  const processBarcode = async (code: string) => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.get('/pos/lookup/', { params: { barcode: code } });
      const data = res.data;
      if (data.multiple) {
        setQuery(code);
      } else {
        const p = data as Product;
        if (p.scanned_unit) {
          const already = cart.some(l => l.product.id === p.id && l.selectedUnits.some(u => u.id === p.scanned_unit?.id));
          if (already) {
            Alert.alert(t('সতর্কতা', 'Warning'), t('এই ইউনিটটি ইতিমধ্যে কার্টে আছে।', 'This unit is already in the cart.'));
          } else {
            const existingLine = cart.find(l => l.product.id === p.id);
            const units = existingLine ? [...existingLine.selectedUnits, p.scanned_unit] : [p.scanned_unit];
            addToCart(p, units, 0);
          }
        } else if (p.units && p.units.length > 0) {
           handleProductTap(p);
        } else {
           addToCart(p, []);
        }
      }
    } catch (e: any) {
      Alert.alert(t('ত্রুটি', 'Error'), e.response?.data?.detail || t('পণ্য পাওয়া যায়নি', 'Product not found'));
    } finally {
      setLoading(false);
      setShowScanner(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleWalkPhoneChange = async (value: string) => {
    setWalkPhone(value);
    if (value.length >= 10) {
      try {
        const res = await api.get('/crm/customers/', { params: { search: value } });
        const match = res.data.results.find((c: any) => c.phone === value);
        if (match) {
          setMatchedId(match.id);
          setWalkName(match.name);
          setWalkEmail(match.email || '');
          setWalkAddress(match.address || '');
        } else if (matchedId) {
          setMatchedId(null);
          setWalkName('');
          setWalkEmail('');
          setWalkAddress('');
        }
      } catch (e) {}
    } else if (matchedId) {
      setMatchedId(null);
      setWalkName('');
      setWalkEmail('');
      setWalkAddress('');
    }
  };

  const rawDiscount = Number(discountInput) || 0;
  const deliveryNum = Number(deliveryCharge) || 0;
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const discountNum = Math.min(rawDiscount, subtotal);
  const total = Math.max(0, subtotal - discountNum + deliveryNum);
  const paidNum = paidAmount ? Number(paidAmount) : 0;
  const changeDue = paidNum > total ? paidNum - total : 0;
  const emiInterestNum = Number(emiInterestPercent) || 0;
  const emiPrincipal = Math.max(0, total - paidNum);
  const emiInterestAmt = emiPrincipal * (emiInterestNum / 100);
  const emiPerMonth = emiMonths ? (emiPrincipal + emiInterestAmt) / emiMonths : 0;

  const totalItemsCount = cart.reduce((s, l) => s + l.qty, 0);

  const handleCheckout = async (asQuotation: boolean = false) => {
    Keyboard.dismiss();
    if (cart.length === 0) return;
    setIsCheckoutLoading(true);
    try {
      if (isEmi && !asQuotation) {
        const finalEmail = customerMode === 'existing' ? existingEmail : walkEmail;
        if (!finalEmail.trim()) {
           throw new Error("EMI-র জন্য Email আবশ্যক (Email is required for EMI)");
        }
      }

      const resolvedItems = await Promise.all(
        cart.map(async (l) => {
          let pId = l.product.id;
          if (pId < 0) {
            try {
              const pRes = await api.post('/catalog/products/', {
                name: l.product.name,
                sku: `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                selling_price: l.price,
                cost_price: 0,
                track_inventory: false,
              });
              pId = pRes.data.id;
            } catch (e: any) {
              throw new Error(isBN ? `কাস্টম পণ্য "${l.product.name}" যোগ করতে ব্যর্থ হয়েছে।` : `Failed to save custom item "${l.product.name}".`);
            }
          }
          return {
            product: pId,
            quantity: l.qty,
            unit_price: l.price,
            discount: l.discount,
            unit_ids: l.selectedUnits ? l.selectedUnits.map(u => u.id) : []
          };
        })
      );

      const payload = {
        customer: customerMode === 'existing' && selectedCustomer ? selectedCustomer.id : (customerMode === 'walkin' && matchedId ? matchedId : null),
        customer_name: customerMode === 'walkin' ? walkName.trim() : "",
        customer_phone: customerMode === 'walkin' ? walkPhone.trim() : "",
        customer_email: customerMode === 'walkin' ? walkEmail.trim() : (customerMode === 'existing' && existingEmail ? existingEmail.trim() : ""),
        customer_address: customerMode === 'walkin' ? walkAddress.trim() : "",
        discount: discountNum,
        delivery_charge: deliveryNum,
        tax: 0,
        note: asQuotation ? "Quotation / প্রাক-বিক্রয় কোটেশন" : "",
        items: resolvedItems,
        payments: asQuotation ? [] : (paidAmount !== "" && Number(paidAmount) >= 0 ? [{ amount: Number(paidAmount), method: paymentMethod }] : [{ amount: total, method: paymentMethod }]),
        sale_date: saleDate || undefined,
        is_emi: asQuotation ? false : isEmi,
        emi_months: (isEmi && !asQuotation) ? emiMonths : 0,
        down_payment: (isEmi && !asQuotation) ? paidNum : 0,
        emi_interest_percent: (isEmi && !asQuotation) ? emiInterestNum : 0,
        is_quotation: asQuotation,
      };
      const res = await api.post('/pos/checkout/', payload);
      
      const rawPdfUrl = res.data.public_invoice_url || res.data.invoice?.public_invoice_url || res.data.invoice?.pdf_url || res.data.pdf_url || '';
      const finalPdfUrl = rawPdfUrl ? (rawPdfUrl.startsWith('http') ? rawPdfUrl : `https://stockwhisk.com${rawPdfUrl}`) : '';
      
      setSaleResult({
        id: res.data.invoice?.id || res.data.id || 0,
        invoice_no: res.data.invoice?.invoice_number || res.data.invoice_number || '',
        phone: payload.customer_phone || (customerMode === 'existing' && selectedCustomer ? selectedCustomer.phone : '') || '',
        name: payload.customer_name || (customerMode === 'existing' && selectedCustomer ? selectedCustomer.name : '') || '',
        total: total,
        pdfUrl: finalPdfUrl
      });
      setCart([]);
      setSelectedCustomer(null);
      setDiscountInput('');
      setDeliveryCharge('');
      setWalkName('');
      setWalkPhone('');
      setWalkEmail('');
      setWalkAddress('');
      setPaidAmount('');
      setIsEmi(false);
      setSaleDate('');
      setView('products');
    } catch (e: any) {
      const isNetwork = !e.response && (e.message?.includes('Network') || e.message?.includes('timeout') || e.code === 'ECONNABORTED');
      const msg = isNetwork
        ? (isBN ? 'ইন্টারনেট সংযোগ বিচ্ছিন্ন। অনুগ্রহ করে নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।' : 'No internet connection. Please check your network and retry.')
        : (e.response?.data?.detail || e.response?.data?.error || e.message || t('চেকআউট ব্যর্থ হয়েছে', 'Checkout failed'));
      Alert.alert(t('ত্রুটি', 'Error'), msg);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        {view === 'cart' && <Appbar.BackAction onPress={() => setView('products')} />}
        <Appbar.Content title={view === 'products' ? t('বিক্রয় / POS', 'POS / Sale') : t('কার্ট (' + totalItemsCount + ' items)', 'Cart (' + totalItemsCount + ' items)')} titleStyle={{ fontWeight: 'bold' }} />
        {view === 'products' ? (
          <TouchableOpacity onPress={() => setView('cart')} style={{ marginRight: 16 }}>
            <MaterialCommunityIcons name="cart-outline" size={28} color={theme.colors.onSurface} />
            {totalItemsCount > 0 && (
              <Badge style={{ position: 'absolute', top: -4, right: -4 }}>{totalItemsCount}</Badge>
            )}
          </TouchableOpacity>
        ) : (
          cart.length > 0 ? <Appbar.Action icon="trash-can-outline" onPress={() => setCart([])} /> : null
        )}
      </Appbar.Header>

      {view === 'products' && (
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              mode="outlined"
              placeholder={t('বারকোড স্ক্যান করুন বা পণ্যের নাম / SKU টাইপ করুন...', 'Type barcode, product name or SKU...')}
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, height: 48, backgroundColor: '#fff' }}
              left={<TextInput.Icon icon="magnify" />}
              right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} /> : null}
            />
            <Button mode="contained" icon="barcode-scan" style={{ marginLeft: 8, height: 48, justifyContent: 'center' }} onPress={openScanner}>
              {t('স্ক্যান', 'Scan')}
            </Button>
          </View>

          {loading && page === 1 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={item => item.id.toString()}
              numColumns={2}
              contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loading && page > 1 ? <ActivityIndicator style={{ margin: 16 }} /> : null}
              renderItem={({ item }) => {
                const stockStr = Number(item.current_stock);
                const outOfStock = item.track_inventory !== false && stockStr <= 0;
                
                return (
                  <TouchableOpacity
                    style={{ flex: 1, margin: 4 }}
                    onPress={() => handleProductTap(item)}
                    disabled={fetchingUnits}
                  >
                    <Surface style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', elevation: 2, height: 120, justifyContent: 'space-between' }}>
                      <View>
                        <Text numberOfLines={2} style={{ fontWeight: 'bold' }}>{item.name}</Text>
                        <Text style={{ fontSize: 10, color: 'gray' }}>{item.sku}</Text>
                      </View>
                      <View>
                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>৳ {item.selling_price}</Text>
                        <Text style={{ fontSize: 12, color: outOfStock ? 'red' : item.is_low_stock ? 'orange' : 'gray' }}>
                          {item.track_inventory === false ? '' : outOfStock ? t('স্টক নেই', 'Out of stock') : t(`স্টক: ${item.current_stock}`, `Stock: ${item.current_stock}`)}
                        </Text>
                      </View>
                    </Surface>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {view === 'cart' && (
        <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ padding: 16 }}>
            {/* 1. Order Summary */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t('অর্ডারের সারাংশ', 'Order Summary')}</Text>
              <Button
                mode="contained-tonal"
                icon="plus"
                compact
                onPress={() => setShowCustomItemModal(true)}
              >
                {t('+ কাস্টম আইটেম', '+ Custom Item')}
              </Button>
            </View>
            {cart.map(l => (
              <Surface key={l.product.id} style={{ padding: 12, borderRadius: 8, elevation: 2, marginBottom: 8, backgroundColor: '#fff' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{l.product.name}</Text>
                    <Text style={{ fontSize: 12, color: 'gray' }}>৳ {l.price}</Text>
                    {l.selectedUnits.length > 0 && (
                      <View style={{ marginTop: 4 }}>
                        {l.selectedUnits.map(u => (
                          <Text key={u.id} style={{ fontSize: 10, fontFamily: 'monospace', color: 'gray' }}>- {u.barcode}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold' }}>৳ {l.price * l.qty}</Text>
                    {l.selectedUnits.length > 0 ? (
                      <View style={{ marginTop: 8, backgroundColor: '#eee', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 }}>
                        <Text>{l.qty}</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <TouchableOpacity onPress={() => updateCartQty(l.product.id, -1)} style={{ padding: 4, backgroundColor: '#eee', borderRadius: 4 }}>
                          <MaterialCommunityIcons name="minus" size={16} />
                        </TouchableOpacity>
                        <Text style={{ marginHorizontal: 12, fontWeight: 'bold' }}>{l.qty}</Text>
                        <TouchableOpacity onPress={() => updateCartQty(l.product.id, 1)} style={{ padding: 4, backgroundColor: '#eee', borderRadius: 4 }}>
                          <MaterialCommunityIcons name="plus" size={16} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <IconButton icon="trash-can-outline" iconColor="red" size={20} onPress={() => removeLine(l.product.id)} />
                </View>
              </Surface>
            ))}

            {/* 2. Customer Selection */}
            <Surface style={{ padding: 16, borderRadius: 8, elevation: 2, marginVertical: 16, backgroundColor: '#fff' }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 16 }}>{t('কাস্টমার ও পেমেন্ট', 'Customer & Payment')}</Text>
              
              <Text style={{ fontSize: 12, color: 'gray', marginBottom: 4 }}>{t('কাস্টমার নির্বাচন করুন', 'Select Customer')}</Text>
              <TouchableOpacity 
                onPress={() => setCustomerSearchFocused(!customerSearchFocused)}
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: '#fff' }}
              >
                <Text>{customerMode === 'walkin' ? t('🚶 ওয়াক-ইন কাস্টমার', '🚶 Walk-in Customer') : selectedCustomer ? `👤 ${selectedCustomer.name} ${selectedCustomer.phone ? '- ' + selectedCustomer.phone : ''}` : t('কাস্টমার নির্বাচন করুন', 'Select Customer')}</Text>
                <MaterialCommunityIcons name={customerSearchFocused ? "chevron-up" : "chevron-down"} size={20} color="gray" />
              </TouchableOpacity>

              {customerSearchFocused && (
                <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 4, backgroundColor: '#fff', marginBottom: 16, elevation: 3 }}>
                  <TextInput 
                    placeholder={t('কাস্টমার খুঁজুন...', 'Search customer...')}
                    value={customerQuery}
                    onChangeText={setCustomerQuery}
                    style={{ height: 40, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 12 }}
                  />
                  <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                    <TouchableOpacity 
                      style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: customerMode === 'walkin' ? '#e0e7ff' : '#fff' }} 
                      onPress={() => { setCustomerMode('walkin'); setSelectedCustomer(null); setCustomerSearchFocused(false); }}
                    >
                      <Text style={{ fontWeight: customerMode === 'walkin' ? 'bold' : 'normal', color: customerMode === 'walkin' ? '#4338ca' : '#000' }}>🚶 {t('ওয়াক-ইন কাস্টমার', 'Walk-in Customer')}</Text>
                    </TouchableOpacity>
                    
                    {customerResults.map(c => (
                      <TouchableOpacity 
                        key={c.id} 
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: customerMode === 'existing' && selectedCustomer?.id === c.id ? '#e0e7ff' : '#fff' }} 
                        onPress={() => { setCustomerMode('existing'); setSelectedCustomer(c); setCustomerSearchFocused(false); }}
                      >
                        <Text style={{ fontWeight: customerMode === 'existing' && selectedCustomer?.id === c.id ? 'bold' : 'normal', color: customerMode === 'existing' && selectedCustomer?.id === c.id ? '#4338ca' : '#000' }}>👤 {c.name} {c.phone ? `- ${c.phone}` : ''}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {customerMode === 'existing' && selectedCustomer && (
                <View style={{ marginTop: 8 }}>
                  <TextInput 
                    mode="outlined" 
                    label={isEmi ? t('ইমেইল (EMI এর জন্য আবশ্যক)', 'Email (Required for EMI)') : t('ইমেইল (ঐচ্ছিক)', 'Email (Optional)')} 
                    value={existingEmail} 
                    onChangeText={setExistingEmail} 
                    style={{ marginBottom: 8, backgroundColor: '#fff' }} 
                    keyboardType="email-address" 
                    error={isEmi && !existingEmail.trim()}
                  />
                  {isEmi && !existingEmail.trim() && <Text style={{ color: 'red', fontSize: 12, marginTop: -4 }}>EMI-র জন্য Email আবশ্যক</Text>}
                </View>
              )}

              {customerMode === 'walkin' && (
                <View style={{ marginTop: 8 }}>
                  <TextInput mode="outlined" label={t('ফোন *', 'Phone *')} value={walkPhone} onChangeText={handleWalkPhoneChange} style={{ marginBottom: 8, backgroundColor: matchedId ? '#eff6ff' : '#fff' }} keyboardType="phone-pad" />
                  {matchedId ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>{t('বিদ্যমান কাস্টমার – তথ্য অটো-ফিল করা হয়েছে।', 'Existing customer - data auto-filled.')}</Text>
                    </View>
                  ) : null}
                  <TextInput mode="outlined" label={t('কাস্টমারের নাম *', 'Customer Name *')} value={walkName} onChangeText={setWalkName} style={{ marginBottom: 8, backgroundColor: '#fff' }} />
                  <TextInput 
                    mode="outlined" 
                    label={isEmi ? t('ইমেইল (EMI এর জন্য আবশ্যক)', 'Email (Required for EMI)') : t('ইমেইল (ঐচ্ছিক)', 'Email (Optional)')} 
                    value={walkEmail} 
                    onChangeText={setWalkEmail} 
                    style={{ marginBottom: 8, backgroundColor: '#fff' }} 
                    keyboardType="email-address" 
                    error={isEmi && !walkEmail.trim()}
                  />
                  {isEmi && !walkEmail.trim() && <Text style={{ color: 'red', fontSize: 12, marginTop: -4 }}>EMI-র জন্য Email আবশ্যক</Text>}
                  <TextInput mode="outlined" label={t('ঠিকানা (ঐচ্ছিক)', 'Address (Optional)')} value={walkAddress} onChangeText={setWalkAddress} style={{ marginBottom: 8, backgroundColor: '#fff' }} />
                </View>
              )}
            </Surface>

            {/* Offline Sale Date */}
            {!!(user as any)?.shop_offline_sale_mode && (
              <Surface style={{ padding: 16, borderRadius: 8, elevation: 2, marginVertical: 8, backgroundColor: '#fffcf0', borderColor: '#fef08a', borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="alert" size={16} color="#ca8a04" style={{ marginRight: 6 }} />
                  <Text style={{ fontWeight: 'bold', color: '#a16207', fontSize: 12 }}>Offline Sale Entry Mode Active</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#a16207', marginBottom: 12 }}>
                  Stock validation is relaxed. You can optionally backdate this sale if recovering from an outage.
                </Text>
                <TextInput 
                  mode="outlined" 
                  label="Backdated Sale Time (Optional)" 
                  value={saleDate} 
                  onChangeText={setSaleDate} 
                  placeholder="YYYY-MM-DDTHH:mm"
                  style={{ backgroundColor: '#fff' }} 
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => {
                      const now = new Date();
                      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      setSaleDate(localIso);
                    }}
                  >
                    {isBN ? '⏱️ বর্তমান সময়' : '⏱️ Current Time'}
                  </Button>
                  {!!saleDate && (
                    <Button mode="text" compact textColor="#dc2626" onPress={() => setSaleDate('')}>
                      {isBN ? 'রিসেট' : 'Reset'}
                    </Button>
                  )}
                </View>
              </Surface>
            )}

            {/* 3. Financials */}
            <Surface style={{ padding: 16, borderRadius: 8, elevation: 2, marginBottom: 16, backgroundColor: '#fff' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>{t('সাবটোটাল', 'Subtotal')}</Text>
                <Text>৳ {subtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text>{t('ডিসকাউন্ট (৳)', 'Discount (৳)')}</Text>
                <TextInput
                  mode="outlined"
                  placeholder="0"
                  keyboardType="numeric"
                  value={discountInput}
                  onChangeText={setDiscountInput}
                  style={{ height: 36, width: 100, backgroundColor: '#fff', textAlign: 'right' }}
                />
              </View>
              {(user as any)?.shop_delivery_enabled !== false && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text>{t('ডেলিভারি চার্জ (৳)', 'Delivery Charge (৳)')}</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="0"
                    keyboardType="numeric"
                    value={deliveryCharge}
                    onChangeText={setDeliveryCharge}
                    style={{ height: 36, width: 100, backgroundColor: '#fff', textAlign: 'right' }}
                  />
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text>{isEmi ? t('ডাউন পেমেন্ট (৳) *', 'Down Payment (৳) *') : t('প্রদত্ত টাকা (৳) *', 'Paid Amount (৳) *')}</Text>
                <TextInput
                  mode="outlined"
                  placeholder="0"
                  keyboardType="numeric"
                  value={paidAmount}
                  onChangeText={setPaidAmount}
                  style={{ height: 36, width: 100, backgroundColor: '#fff', textAlign: 'right' }}
                />
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{t('মোট', 'Total')}</Text>
                <Text style={{ fontWeight: 'bold', fontSize: 24, color: theme.colors.primary }}>৳ {total.toFixed(2)}</Text>
              </View>
              
              {changeDue > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 14, color: '#0ea5e9', fontWeight: 'bold' }}>{t('চেঞ্জ ডিউ (খুচরা ফেরত)', 'Change Due')}</Text>
                  <Text style={{ fontSize: 16, color: '#0ea5e9', fontWeight: 'bold' }}>৳ {changeDue.toFixed(2)}</Text>
                </View>
              )}
              {paidAmount !== '' && paidNum < total && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 14, color: 'red', fontWeight: 'bold' }}>{t('বাকি', 'Due')}</Text>
                  <Text style={{ fontSize: 16, color: 'red', fontWeight: 'bold' }}>৳ {(total - paidNum).toFixed(2)}</Text>
                </View>
              )}
            </Surface>

            {/* 4. Payment Method */}
            <Text style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>{t('পেমেন্ট মাধ্যম', 'Payment Method')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {(['cash', 'card', 'bkash', 'nagad', 'bank_transfer'] as const).map(method => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={{
                    flex: 1, minWidth: 95, padding: 8, borderRadius: 8, alignItems: 'center',
                    borderWidth: 1, borderColor: paymentMethod === method ? theme.colors.primary : '#ccc',
                    backgroundColor: paymentMethod === method ? theme.colors.primaryContainer : '#fff'
                  }}
                >
                  <MaterialCommunityIcons name={method === 'cash' ? 'cash' : method === 'card' ? 'credit-card' : method === 'bank_transfer' ? 'bank' : 'cellphone'} size={20} color={paymentMethod === method ? theme.colors.primary : 'gray'} />
                  <Text style={{ marginTop: 4, fontSize: 12, color: paymentMethod === method ? theme.colors.primary : 'gray', textTransform: 'capitalize' }}>{method.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* EMI Options */}
            {!!(user as any)?.shop_emi_enabled && (
              <Surface style={{ padding: 16, borderRadius: 8, elevation: 2, marginBottom: 24, backgroundColor: '#fff' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#4338ca' }}>{t('ইএমআই (কিস্তি) সুবিধা', 'EMI Setup')}</Text>
                  <Checkbox.Android status={isEmi ? 'checked' : 'unchecked'} onPress={() => setIsEmi(!isEmi)} color="#4338ca" />
                </View>
                
                  {isEmi && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 12, marginBottom: 8, color: 'gray', fontWeight: '600' }}>{t('কিস্তির মেয়াদ (মাস)', 'EMI Duration (Months)')}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {[3, 6, 9, 12, 18, 24].map(m => (
                            <TouchableOpacity key={m} onPress={() => setEmiMonths(m)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: emiMonths === m ? '#4338ca' : '#f1f5f9', marginRight: 6, marginBottom: 6 }}>
                              <Text style={{ color: emiMonths === m ? '#fff' : '#64748b', fontSize: 13, fontWeight: emiMonths === m ? 'bold' : 'normal' }}>{m}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={{ width: 110 }}>
                        <TextInput mode="outlined" label={t('ইন্টারেস্ট %', 'Interest %')} value={emiInterestPercent} onChangeText={setEmiInterestPercent} keyboardType="numeric" style={{ backgroundColor: '#fff' }} dense />
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: '#eef2ff', padding: 12, borderRadius: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: 'gray' }}>{t('আসল পরিমাণ', 'Principal')}</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>৳ {emiPrincipal.toFixed(2)}</Text>
                      </View>
                      {emiInterestNum > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, color: 'gray' }}>{t('ইন্টারেস্ট (' + emiInterestNum + '%)', 'Interest (' + emiInterestNum + '%)')}</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>৳ {emiInterestAmt.toFixed(2)}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1, borderTopColor: '#c7d2fe', paddingTop: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4338ca' }}>{t('প্রতি মাসে কিস্তি', 'Per Month')}</Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#4338ca' }}>৳ {emiPerMonth.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </Surface>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <Button
                mode="outlined"
                icon="file-document-outline"
                onPress={() => handleCheckout(true)}
                loading={isCheckoutLoading}
                disabled={cart.length === 0 || isCheckoutLoading}
                style={{ flex: 1, borderRadius: 8, borderColor: '#4f46e5' }}
                textColor="#4f46e5"
                labelStyle={{ fontSize: 13, fontWeight: 'bold' }}
              >
                {t('কোটেশন সেভ', 'Quotation')}
              </Button>

              <Button
                mode="contained"
                icon="check-circle"
                onPress={() => handleCheckout(false)}
                loading={isCheckoutLoading}
                disabled={cart.length === 0 || isCheckoutLoading || (customerMode === 'walkin' && (!walkPhone || !walkName))}
                style={{ flex: 2, borderRadius: 8 }}
                labelStyle={{ fontSize: 15, fontWeight: 'bold' }}
              >
                {t('চেকআউট', 'Checkout')}
              </Button>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={(code) => processBarcode(code)}
      />

      <Modal visible={unitModalVisible} transparent animationType="fade" onRequestClose={() => setUnitModalVisible(false)}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }} 
          activeOpacity={1} 
          onPressOut={() => setUnitModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ maxHeight: '90%', width: '100%', maxWidth: 480, flexShrink: 1 }}>
            <Surface style={{ borderRadius: 16, padding: 18, backgroundColor: theme.colors.surface, elevation: 8, flexShrink: 1 }}>
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9', paddingBottom: 10 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: theme.colors.onSurface }}>
                    {selectedProductForUnit?.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      SKU: {selectedProductForUnit?.sku || 'N/A'}
                    </Text>
                    <View style={{ backgroundColor: Number(selectedProductForUnit?.current_stock || 0) > 0 ? '#dcfce7' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: Number(selectedProductForUnit?.current_stock || 0) > 0 ? '#16a34a' : '#dc2626' }}>
                        {isBN ? `মজুদ: ${selectedProductForUnit?.current_stock || 0}` : `Stock: ${selectedProductForUnit?.current_stock || 0}`}
                      </Text>
                    </View>
                  </View>
                </View>
                <IconButton icon="close" size={22} onPress={() => setUnitModalVisible(false)} style={{ margin: 0, marginTop: -6, marginRight: -6 }} />
              </View>
              
              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
                {/* 1. If Serialized / Units Available */}
                {selectedProductForUnit?.units && selectedProductForUnit.units.length > 0 ? (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13, color: theme.colors.onSurface }}>
                        🏷️ {isBN ? `বারকোড / সিরিয়াল নির্বাচন (${tempSelectedUnits.length} টি)` : `Select Barcodes (${tempSelectedUnits.length})`}
                      </Text>
                      {selectedProductForUnit.units.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            if (tempSelectedUnits.length === selectedProductForUnit.units?.length) {
                              setTempSelectedUnits([]);
                            } else {
                              setTempSelectedUnits([...(selectedProductForUnit.units || [])]);
                            }
                          }}
                        >
                          <Text style={{ fontSize: 12, color: '#4f46e5', fontWeight: 'bold' }}>
                            {tempSelectedUnits.length === selectedProductForUnit.units?.length 
                              ? (isBN ? 'সব বাতিল' : 'Deselect All') 
                              : (isBN ? 'সব নির্বাচন' : 'Select All')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {selectedProductForUnit.units.length > 4 && (
                      <TextInput
                        mode="outlined"
                        dense
                        placeholder={isBN ? 'বারকোড বা সিরিয়াল খুঁজুন...' : 'Search barcode / serial...'}
                        value={unitSearchQuery}
                        onChangeText={setUnitSearchQuery}
                        style={{ marginBottom: 8, backgroundColor: theme.colors.surface, height: 38 }}
                        left={<TextInput.Icon icon="magnify" size={18} />}
                      />
                    )}

                    <View style={{ maxHeight: 200 }}>
                      <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                        {selectedProductForUnit.units
                          .filter(u => !unitSearchQuery || String(u.barcode || '').toLowerCase().includes(unitSearchQuery.toLowerCase()))
                          .map(u => {
                            const isSelected = tempSelectedUnits.some(tu => tu.id === u.id);
                            return (
                              <TouchableOpacity
                                key={u.id}
                                onPress={() => toggleUnitSelection(u)}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8,
                                  borderWidth: 1, borderColor: isSelected ? '#4f46e5' : isDarkMode ? '#334155' : '#e2e8f0',
                                  backgroundColor: isSelected ? (isDarkMode ? '#1e1b4b' : '#eff6ff') : theme.colors.surface,
                                  marginBottom: 6
                                }}
                              >
                                <Checkbox status={isSelected ? 'checked' : 'unchecked'} color="#4f46e5" />
                                <View style={{ flex: 1, marginLeft: 6 }}>
                                  <Text style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, color: theme.colors.onSurface }}>
                                    {u.barcode}
                                  </Text>
                                  {!!u.effective_warranty_months && (
                                    <Text style={{ fontSize: 10, color: '#d97706' }}>
                                      <MaterialCommunityIcons name="shield-check" size={10} /> {u.effective_warranty_months} {isBN ? 'মাস ওয়ারেন্টি' : 'Months Warranty'}
                                    </Text>
                                  )}
                                </View>
                                <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#16a34a' }}>
                                  ৳{u.effective_selling_price || selectedProductForUnit.selling_price}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                      </ScrollView>
                    </View>
                  </View>
                ) : (
                  /* 2. Non-serialized / Bulk Quantity Selector */
                  <View style={{ marginBottom: 14, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 10 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, color: theme.colors.onSurface }}>
                      📦 {isBN ? 'পরিমাণ (Quantity)' : 'Quantity'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseFloat(modalQty) || 1;
                          if (current > 1) setModalQty(String(current - 1));
                        }}
                        style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <MaterialCommunityIcons name="minus" size={20} color={theme.colors.onSurface} />
                      </TouchableOpacity>

                      <TextInput
                        mode="outlined"
                        dense
                        keyboardType="numeric"
                        value={modalQty}
                        onChangeText={setModalQty}
                        style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 16, height: 40, backgroundColor: theme.colors.surface }}
                      />

                      <TouchableOpacity
                        onPress={() => {
                          const current = parseFloat(modalQty) || 0;
                          setModalQty(String(current + 1));
                        }}
                        style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {/* Quick quantity chips */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                      {[1, 2, 5, 10].map(q => (
                        <TouchableOpacity
                          key={q}
                          onPress={() => setModalQty(String(q))}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6,
                            backgroundColor: modalQty === String(q) ? '#4f46e5' : isDarkMode ? '#334155' : '#e2e8f0'
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: modalQty === String(q) ? '#fff' : theme.colors.onSurface }}>
                            {q}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* 3. Price & Item Discount row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 }}>
                      {isBN ? 'একক মূল্য (৳)' : 'Unit Price (৳)'}
                    </Text>
                    <TextInput
                      mode="outlined"
                      dense
                      keyboardType="numeric"
                      value={modalPrice}
                      onChangeText={setModalPrice}
                      style={{ height: 40, backgroundColor: theme.colors.surface }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 }}>
                      {isBN ? 'আইটেম ছাড় (৳)' : 'Item Discount (৳)'}
                    </Text>
                    <TextInput
                      mode="outlined"
                      dense
                      keyboardType="numeric"
                      placeholder="0"
                      value={modalDiscount}
                      onChangeText={setModalDiscount}
                      style={{ height: 40, backgroundColor: theme.colors.surface }}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer / Total & Add to Cart button */}
              <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9', paddingTop: 12, flexShrink: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>
                    {isBN ? 'মোট নির্বাচিত' : 'Total Items'}: <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>
                      {selectedProductForUnit?.units && selectedProductForUnit.units.length > 0 
                        ? `${tempSelectedUnits.length} টি` 
                        : `${modalQty} টি`}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#4f46e5' }}>
                    ৳{Math.max(0, (((selectedProductForUnit?.units && selectedProductForUnit.units.length > 0 ? tempSelectedUnits.length : (parseFloat(modalQty) || 1)) * (parseFloat(modalPrice) || 0)) - (parseFloat(modalDiscount) || 0))).toFixed(2)}
                  </Text>
                </View>

                <Button 
                  mode="contained" 
                  icon="cart-plus"
                  onPress={confirmUnitSelection}
                  style={{ borderRadius: 8, backgroundColor: '#4f46e5' }}
                  labelStyle={{ fontSize: 14, fontWeight: 'bold', paddingVertical: 2 }}
                >
                  {isBN ? 'কার্টে যুক্ত করুন' : 'Add to Cart'}
                </Button>
              </View>
            </Surface>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={!!saleResult} transparent animationType="fade" onRequestClose={() => setSaleResult(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Surface style={{ width: '100%', maxWidth: 400, padding: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <MaterialCommunityIcons name="check" size={40} color="#16a34a" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>{t('বিক্রি সম্পন্ন হয়েছে!', 'Sale Completed!')}</Text>
            <Text style={{ fontSize: 14, color: 'gray', marginBottom: 24, textAlign: 'center' }}>
              {t('ইনভয়েস', 'Invoice')}: {saleResult?.invoice_no}
            </Text>

            <View style={{ width: '100%', gap: 12 }}>
              <Button 
                mode="contained" 
                icon="printer" 
                onPress={async () => {
                  try {
                    if (Platform.OS === 'web') {
                      if (saleResult?.id) {
                        window.open(`https://stockwhisk.com/invoice/${saleResult.id}`, '_blank');
                      }
                    } else {
                      if (saleResult?.pdfUrl) {
                        await Print.printAsync({ uri: saleResult.pdfUrl });
                      } else if (saleResult?.id) {
                        Linking.openURL(`https://stockwhisk.com/invoice/${saleResult.id}`);
                      }
                    }
                  } catch (err) {
                    console.error("Print error:", err);
                    Alert.alert(t('ত্রুটি', 'Error'), t('প্রিন্ট করা যায়নি।', 'Could not print.'));
                  }
                }}
                style={{ borderRadius: 8, paddingVertical: 4 }}
              >
                {t('ইনভয়েস প্রিন্ট করুন', 'Print Invoice')}
              </Button>

              {((user as any)?.shop_whatsapp_enabled !== false) && saleResult?.phone && saleResult.phone.replace(/\D/g, '').length >= 10 && (
                <Button 
                  mode="contained" 
                  icon="whatsapp" 
                  buttonColor="#25D366"
                  textColor="#fff"
                  onPress={() => {
                    const digits = saleResult.phone.replace(/\D/g, "");
                    const intl = digits.startsWith("880") ? digits : (digits.startsWith("01") ? `88${digits}` : digits);
                    const msg = t(`হ্যালো ${saleResult.name},\n\n`, `Hello ${saleResult.name},\n\n`)
                      + t(`আপনার ইনভয়েস #${saleResult.invoice_no}\nমোট বিল: ৳${saleResult.total.toFixed(2)}\n\n`, `Your invoice #${saleResult.invoice_no}\nTotal bill: ৳${saleResult.total.toFixed(2)}\n\n`)
                      + (saleResult.pdfUrl ? t(`আপনার ইনভয়েস এখানে দেখতে পারেন: ${saleResult.pdfUrl}\n\n`, `You can view your invoice here: ${saleResult.pdfUrl}\n\n`) : "")
                      + t(`আমাদের সাথে থাকার জন্য ধন্যবাদ!`, `Thank you for shopping with us!`);
                    const waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
                    Linking.openURL(waUrl);
                    setSaleResult(null);
                  }}
                  style={{ borderRadius: 8, paddingVertical: 4 }}
                >
                  {t('হোয়াটসঅ্যাপে পাঠান', 'Send to WhatsApp')}
                </Button>
              )}

              <Button 
                mode="outlined" 
                onPress={() => setSaleResult(null)}
                style={{ borderRadius: 8, paddingVertical: 4, marginTop: 8 }}
              >
                {t('নতুন বিক্রি শুরু করুন', 'Start New Sale')}
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>

      {/* Custom Ad-hoc Item Modal */}
      <Modal visible={showCustomItemModal} onDismiss={() => setShowCustomItemModal(false)} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <Surface style={{ width: '100%', maxWidth: 400, borderRadius: 12, padding: 20, backgroundColor: '#fff', elevation: 5 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              {t('কাস্টম আইটেম যুক্ত করুন', 'Add Custom / Ad-hoc Item')}
            </Text>
            <TextInput
              mode="outlined"
              label={t('পণ্যের বা সেবার নাম', 'Item or Service Name')}
              value={customItemName}
              onChangeText={setCustomItemName}
              style={{ marginBottom: 12, backgroundColor: '#fff' }}
              placeholder={t('যেমন: স্পেশাল রিপেয়ার ফি', 'e.g. Special repair fee')}
            />
            <TextInput
              mode="outlined"
              label={t('বিক্রয় মূল্য (৳)', 'Selling Price (৳)')}
              value={customItemPrice}
              onChangeText={setCustomItemPrice}
              keyboardType="numeric"
              style={{ marginBottom: 12, backgroundColor: '#fff' }}
            />
            <TextInput
              mode="outlined"
              label={t('পরিমাণ', 'Quantity')}
              value={customItemQty}
              onChangeText={setCustomItemQty}
              keyboardType="numeric"
              style={{ marginBottom: 20, backgroundColor: '#fff' }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Button mode="outlined" onPress={() => setShowCustomItemModal(false)}>
                {t('বাতিল', 'Cancel')}
              </Button>
              <Button mode="contained" buttonColor="#4f46e5" onPress={handleAddCustomItem}>
                {t('কার্টে যোগ করুন', 'Add to Cart')}
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>

    </View>
  );
}
