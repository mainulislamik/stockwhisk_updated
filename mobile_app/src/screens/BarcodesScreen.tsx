import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, Platform, FlatList, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Button, useTheme, Surface, SegmentedButtons, Searchbar } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { api } from '../api';

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  selling_price: string;
  current_stock: string | number;
};

export default function BarcodesScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const shopPrefix = ((user as any)?.shop_barcode_prefix || '').toUpperCase();
  const shopName = ((user as any)?.shop_name || 'StockWhisk');
  
  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Generator State
  const [quantity, setQuantity] = useState<string>('10');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  
  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  const [isPrinting, setIsPrinting] = useState(false);

  // Load products dynamically
  const fetchProducts = async (query = '') => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/catalog/products/', { params: { search: query, page_size: 50, light: 1 } });
      setProducts(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') {
      const timeout = setTimeout(() => {
        fetchProducts(searchQuery);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, activeTab]);

  const handleGenerate = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 100) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? '১ থেকে ১০০ এর মধ্যে পরিমাণ লিখুন।' : 'Please enter quantity between 1 and 100.');
      return;
    }

    const codes: string[] = [];
    const base = Date.now().toString().slice(-6);
    for (let i = 0; i < qty; i++) {
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      codes.push(`${shopPrefix}${base}${randomStr}${i}`);
    }
    setGeneratedCodes(codes);
  };

  // Utility to fetch ALL products (paginated loop) for "Print All"
  const fetchAllProducts = async (): Promise<Product[]> => {
    let all: Product[] = [];
    let page = 1;
    let hasMore = true;
    while(hasMore) {
      const res = await api.get('/catalog/products/', { params: { search: searchQuery, page, page_size: 100, light: 1 } });
      const data = res.data.results || res.data;
      if (data && data.length > 0) {
        all = [...all, ...data];
        page++;
        if (!res.data.next) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return all;
  };

  const executePrint = async (html: string) => {
    setIsPrinting(true);
    try {
      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 1000);
          }, 1000);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      console.error(e);
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'প্রিন্ট করতে ব্যর্থ হয়েছে।' : 'Failed to print.');
    } finally {
      setIsPrinting(false);
    }
  };

  const getJsBarcodeScript = async () => {
    try {
      const scriptRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js');
      return await scriptRes.text();
    } catch (e) {
      return '';
    }
  };

  const getHtmlTemplate = (labelsHtml: string, jsScript: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; display: flex; flex-wrap: wrap; font-family: monospace; }
        .label {
          width: 38mm; height: 25mm;
          box-sizing: border-box;
          padding: 2mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: white; color: black;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .shop-name { font-size: 8px; font-weight: bold; text-align: center; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .product-name { font-size: 7px; text-align: center; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .code-box { display: flex; justify-content: center; align-items: center; }
        .code-box svg { height: 10mm !important; width: auto !important; max-width: 34mm !important; }
        .code-text { font-size: 7px; margin-top: 1px; letter-spacing: 1px; font-weight: bold; }
        .price-text { font-size: 8px; font-weight: bold; margin-top: 1px; }
        @media print {
          body { width: 38mm; }
          .label { margin: 0; border: none; page-break-after: always; }
        }
      </style>
      ${jsScript ? `<script>${jsScript}</script>` : '<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>'}
    </head>
    <body>
      ${labelsHtml}
      <script>
        window.onload = function() {
          if (typeof JsBarcode !== 'undefined') { JsBarcode(".barcode").init(); }
        };
        if (typeof JsBarcode !== 'undefined') { try { JsBarcode(".barcode").init(); } catch(e) {} }
      </script>
    </body>
    </html>
  `;

  // Print generated blank codes
  const handlePrintGeneratedLabels = async (singleCode?: string) => {
    const codesToPrint = singleCode ? [singleCode] : generatedCodes;
    if (codesToPrint.length === 0) return;
    
    setIsPrinting(true);
    const jsScript = await getJsBarcodeScript();
    
    const labelsHtml = codesToPrint.map(code => `
      <div class="label">
        <div class="shop-name">${shopName}</div>
        <div class="code-box"><svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${code}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg></div>
        <div class="code-text">${code}</div>
      </div>
    `).join('');
    
    await executePrint(getHtmlTemplate(labelsHtml, jsScript));
  };

  // Print existing product barcodes
  const handlePrintProductLabels = async (product?: Product) => {
    setIsPrinting(true);
    
    let productsToPrint: Product[] = [];
    if (product) {
      productsToPrint = [product];
    } else {
      // Fetch all to print all
      productsToPrint = await fetchAllProducts();
    }
    
    if (productsToPrint.length === 0) {
      setIsPrinting(false);
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'প্রিন্ট করার মতো কোনো পণ্য পাওয়া যায়নি।' : 'No products found to print.');
      return;
    }

    const jsScript = await getJsBarcodeScript();
    
    const labelsHtml = productsToPrint.filter(p => p.barcode || p.sku).map(p => {
      const code = p.barcode || p.sku;
      return `
      <div class="label">
        <div class="shop-name">${shopName}</div>
        <div class="product-name">${p.name}</div>
        <div class="code-box"><svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${code}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg></div>
        <div class="price-text">Price: Tk ${Number(p.selling_price).toLocaleString()}</div>
      </div>
    `}).join('');
    
    if(!labelsHtml) {
      setIsPrinting(false);
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'পণ্যের বারকোড বা SKU নেই।' : 'Products do not have Barcode/SKU.');
      return;
    }
    
    await executePrint(getHtmlTemplate(labelsHtml, jsScript));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'বারকোড জেনারেটর' : 'Barcode Generator'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/barcodes" />
      </Appbar.Header>

      <View style={{ padding: 12, backgroundColor: theme.colors.surface, elevation: 2 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'products', label: isBN ? 'প্রোডাক্ট বারকোড' : 'Product Barcodes' },
            { value: 'generator', label: isBN ? 'র‍্যান্ডম জেনারেটর' : 'Random Generator' },
          ]}
          style={{ marginBottom: activeTab === 'products' ? 12 : 0 }}
        />
        
        {activeTab === 'products' && (
          <Searchbar
            placeholder={isBN ? 'পণ্য খুঁজুন...' : 'Search products...'}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={{ elevation: 0, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.outline }}
            iconColor={theme.colors.primary}
          />
        )}
      </View>

      {activeTab === 'products' ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant }}>
             <Text style={{ fontWeight: 'bold' }}>{isBN ? 'বিদ্যমান পণ্যসমূহ' : 'Existing Products'}</Text>
             <Button 
                mode="contained" 
                icon="printer" 
                buttonColor="#16a34a"
                compact
                loading={isPrinting}
                disabled={isPrinting || loadingProducts}
                onPress={() => handlePrintProductLabels()}
             >
                {isBN ? 'সবগুলো প্রিন্ট' : 'Print All'}
             </Button>
          </View>
          
          {loadingProducts ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={products}
              keyExtractor={p => p.id.toString()}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <Card style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}>
                  <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15 }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>
                        {isBN ? 'বারকোড/SKU:' : 'Code:'} {item.barcode || item.sku || 'N/A'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                       <Text style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>৳{Number(item.selling_price).toLocaleString()}</Text>
                       <Button 
                         mode="outlined" 
                         compact 
                         onPress={() => handlePrintProductLabels(item)}
                         disabled={isPrinting || (!item.barcode && !item.sku)}
                         style={{ borderColor: theme.colors.primary }}
                       >
                         {isBN ? 'প্রিন্ট' : 'Print'}
                       </Button>
                    </View>
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 40, color: theme.colors.onSurfaceVariant }}>
                  {isBN ? 'কোনো পণ্য পাওয়া যায়নি।' : 'No products found.'}
                </Text>
              }
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Card style={{ backgroundColor: theme.colors.surface, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <MaterialCommunityIcons name="barcode-scan" size={24} color="#4f46e5" style={{ marginRight: 8 }} />
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                {isBN ? 'ফাঁকা বারকোড তৈরি করুন' : 'Generate Blank Barcodes'}
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              {isBN 
                ? 'নতুন পণ্যের গায়ে লাগানোর জন্য র‍্যান্ডম বারকোড স্টিকার তৈরি করুন।' 
                : 'Generate random barcode label stickers for new inventory.'}
            </Text>

            {!!shopPrefix && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, backgroundColor: '#eff6ff', padding: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 13, color: '#1e40af', marginRight: 6 }}>
                  {isBN ? 'শপ প্রিফিক্স:' : 'Shop Prefix:'}
                </Text>
                <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, includeFontPadding: false }}>
                    {shopPrefix}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              mode="outlined"
              label={isBN ? 'স্টিকার সংখ্যা (Quantity)' : 'Sticker Quantity'}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              style={{ backgroundColor: theme.colors.surface, marginBottom: 14 }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['1', '5', '10', '20', '50'].map(q => {
                const isSelected = quantity === q;
                return (
                  <TouchableOpacity 
                    key={q} 
                    onPress={() => setQuantity(q)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? '#4f46e5' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      borderWidth: 1,
                      borderColor: isSelected ? '#4f46e5' : (isDarkMode ? '#334155' : '#cbd5e1'),
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: isSelected ? 'bold' : '600',
                      color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                      textAlign: 'center',
                    }}>
                      {q}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button mode="contained" buttonColor="#4f46e5" icon="cog-sync" onPress={handleGenerate}>
              {isBN ? 'বারকোড তৈরি করুন' : 'Generate Barcodes'}
            </Button>
          </Card>

          {generatedCodes.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                  {isBN ? `উৎপন্ন বারকোড (${generatedCodes.length}টি)` : `Generated Barcodes (${generatedCodes.length})`}
                </Text>
                <Button
                  mode="contained"
                  buttonColor="#16a34a"
                  icon="printer"
                  compact
                  loading={isPrinting}
                  disabled={isPrinting}
                  onPress={() => handlePrintGeneratedLabels()}
                >
                  {isBN ? 'সবগুলো প্রিন্ট' : 'Print All'}
                </Button>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {generatedCodes.map((code, index) => (
                  <TouchableOpacity key={index} style={{ width: '48%' }} activeOpacity={0.7} onPress={() => handlePrintGeneratedLabels(code)}>
                    <Surface style={{ padding: 12, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : '#e2e8f0', alignItems: 'center', position: 'relative' }} elevation={1}>
                      <MaterialCommunityIcons name="printer" size={16} color="#16a34a" style={{ position: 'absolute', top: 6, right: 6 }} />
                      <MaterialCommunityIcons name="barcode" size={32} color="#4f46e5" />
                      <Text style={{ fontWeight: 'bold', fontSize: 12, marginTop: 4 }}>{code}</Text>
                    </Surface>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
