import React, { useState, useEffect } from 'react';
import { View, ScrollView, RefreshControl, Dimensions, TouchableOpacity, FlatList, Keyboard } from 'react-native';
import { Appbar, Text, Card, useTheme, Surface, Chip, ActivityIndicator, Searchbar, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import PageGuideButton from '../components/PageGuideButton';
import ProductDetailModal from '../components/ProductDetailModal';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  selling_price: string;
  cost_price: string;
  current_stock: string | number;
  category?: { id: number; name: string };
  brand?: { id: number; name: string };
  warranty_months?: number;
};

export default function LookupScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  
  const [scannerVisible, setScannerVisible] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const doSearch = async (query: string) => {
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    try {
      const res = await api.get('/catalog/products/', {
        params: { search: term }
      });
      const data = res.data.results || res.data || [];
      setResults(data);
      setSearched(true);
      
      // If exactly one result and it's a barcode scan, maybe open it automatically?
      // Just keep it simple and list the results.
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timeout = setTimeout(() => {
        doSearch(searchQuery);
      }, 500);
      return () => clearTimeout(timeout);
    } else if (searchQuery.trim().length === 0) {
      setResults([]);
      setSearched(false);
    }
  }, [searchQuery]);

  const handleScan = (code: string) => {
    setScannerVisible(false);
    setSearchQuery(code);
    doSearch(code);
  };

  const openDetail = (prod: Product) => {
    setSelectedProduct(prod);
    setDetailVisible(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setSearched(false);
    Keyboard.dismiss();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'আইটেম ও সিরিয়াল লুকআপ' : 'Item & Serial Lookup'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/products/lookup" />
      </Appbar.Header>

      <View style={{ padding: 16, backgroundColor: theme.colors.surface, elevation: 2 }}>
        <Searchbar
          placeholder={isBN ? 'বারকোড, SKU বা নাম লিখুন...' : 'Type barcode, SKU or name...'}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ elevation: 0, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.outline, marginBottom: 12 }}
          iconColor={theme.colors.primary}
          autoFocus={false}
          clearIcon={searchQuery ? 'close' : undefined}
          onClearIconPress={clearSearch}
        />
        
        <Button 
          mode="contained" 
          icon="barcode-scan" 
          onPress={() => setScannerVisible(true)}
          style={{ paddingVertical: 4 }}
          buttonColor={theme.colors.primary}
        >
          {isBN ? 'ক্যামেরা দিয়ে স্ক্যান করুন' : 'Scan with Camera'}
        </Button>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>{isBN ? 'খোঁজা হচ্ছে...' : 'Searching...'}</Text>
        </View>
      ) : searched ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <Text style={{ marginBottom: 12, fontWeight: 'bold', color: theme.colors.onSurfaceVariant }}>
              {isBN ? `ফলাফল পাওয়া গেছে: ${results.length}টি` : `Found: ${results.length} product(s)`}
            </Text>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <MaterialCommunityIcons name="magnify-scan" size={64} color={theme.colors.outline} />
              <Text style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: theme.colors.onSurface }}>
                {isBN ? 'কোনো আইটেম পাওয়া যায়নি' : 'No item found'}
              </Text>
              <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 32 }}>
                {isBN ? 'সঠিক বারকোড, SKU বা নাম দিয়ে পুনরায় চেষ্টা করুন।' : 'Try searching with a valid barcode, SKU or name.'}
              </Text>
              <Button mode="outlined" onPress={clearSearch} style={{ marginTop: 24 }}>
                {isBN ? 'মুছুন ও আবার খুঁজুন' : 'Clear and Try Again'}
              </Button>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.7} onPress={() => openDetail(item)}>
              <Card style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: theme.colors.primary }}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <MaterialCommunityIcons name="barcode" size={14} color={theme.colors.outline} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>{isBN ? 'SKU/বারকোড:' : 'SKU/Barcode:'} <Text style={{fontWeight: 'bold', color: theme.colors.onSurface}}>{item.sku || item.barcode || 'N/A'}</Text></Text>
                      </View>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.onSurface }}>৳{Number(item.selling_price).toLocaleString('en-US')}</Text>
                      <Surface style={{ marginTop: 6, backgroundColor: Number(item.current_stock) > 0 ? theme.colors.primaryContainer : theme.colors.errorContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: Number(item.current_stock) > 0 ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer, fontWeight: 'bold', fontSize: 12 }}>
                          {isBN ? 'স্টক:' : 'Stock:'} {item.current_stock}
                        </Text>
                      </Surface>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <MaterialCommunityIcons name="line-scan" size={80} color={isDarkMode ? '#334155' : '#cbd5e1'} />
          <Text style={{ marginTop: 20, fontSize: 16, textAlign: 'center', color: theme.colors.onSurfaceVariant, lineHeight: 24 }}>
            {isBN 
              ? 'মোবাইলের ক্যামেরা দিয়ে পণ্যের সিরিয়াল বা বারকোড স্ক্যান করুন, অথবা উপরে নাম/SKU লিখে খুঁজুন।'
              : 'Scan a product serial or barcode with your camera, or type its name/SKU above to look it up.'}
          </Text>
        </View>
      )}

      {/* Reused existing modals */}
      <CameraBarcodeScannerModal 
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScan}
      />
      
      {selectedProduct && (
        <ProductDetailModal
          visible={detailVisible}
          product={selectedProduct}
          onClose={() => setDetailVisible(false)}
        />
      )}
    </View>
  );
}
