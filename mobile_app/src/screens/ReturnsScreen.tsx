import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, Button, Divider, useTheme, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import CameraBarcodeScannerModal from '../components/CameraBarcodeScannerModal';

export default function ReturnsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [activeTab, setActiveTab] = useState<'return' | 'replace'>('return');
  const [scannerTarget, setScannerTarget] = useState<'return' | 'old' | 'new' | null>(null);
  
  // Return State
  const [barcode, setBarcode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [action, setAction] = useState<'restock' | 'scrap'>('restock');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Replace State
  const [oldBarcode, setOldBarcode] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [oldScanResult, setOldScanResult] = useState<any>(null);

  const handleScanReturn = async () => {
    if (!barcode.trim()) return;
    setLoading(true);
    setScanResult(null);
    try {
      const res = await api.get(`/sales/sales/scan-return/?barcode=${encodeURIComponent(barcode.trim())}`);
      setScanResult(res.data);
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.response?.data?.detail || err.message || (isBN ? 'বারকোড খুঁজে পাওয়া যায়নি।' : 'Barcode not found.'));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!scanResult) return;
    setProcessing(true);
    try {
      await api.post('/sales/sales/process-scan-return/', {
        barcode: scanResult.unit?.barcode || scanResult.barcode,
        action: action,
        refund_method: refundMethod
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পণ্য ফেরত সম্পন্ন হয়েছে এবং রিফান্ড প্রসেস হয়েছে।' : 'Return processed successfully!');
      setScanResult(null);
      setBarcode('');
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.response?.data?.detail || err.message || (isBN ? 'রিটার্ন ব্যর্থ হয়েছে।' : 'Return failed.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleScanReplaceOld = async () => {
    if (!oldBarcode.trim()) return;
    setLoading(true);
    setOldScanResult(null);
    try {
      const res = await api.get(`/sales/sales/scan-return/?barcode=${encodeURIComponent(oldBarcode.trim())}`);
      setOldScanResult(res.data);
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.response?.data?.detail || (isBN ? 'পুরনো বারকোড খুঁজে পাওয়া যায়নি।' : 'Original item barcode not found.'));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReplace = async () => {
    if (!oldScanResult || !newBarcode.trim()) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'উভয় পণ্যের বারকোড আবশ্যক।' : 'Both barcodes are required.');
      return;
    }
    setProcessing(true);
    try {
      await api.post('/sales/sales/replace-unit/', {
        old_barcode: oldScanResult.unit?.barcode || oldScanResult.barcode,
        new_barcode: newBarcode.trim()
      });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পণ্য পরিবর্তন (Replacement) সম্পন্ন হয়েছে।' : 'Item replacement completed!');
      setOldScanResult(null);
      setOldBarcode('');
      setNewBarcode('');
    } catch (err: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', err.response?.data?.detail || err.message || (isBN ? 'রিপ্লেসমেন্ট ব্যর্থ হয়েছে।' : 'Replacement failed.'));
    } finally {
      setProcessing(false);
    }
  };

  const METHODS = [
    { key: 'cash', label: isBN ? 'ক্যাশ' : 'Cash' },
    { key: 'bkash', label: 'bKash' },
    { key: 'nagad', label: 'Nagad' },
    { key: 'card', label: isBN ? 'কার্ড' : 'Card' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'পণ্য ফেরত ও পরিবর্তন' : 'Returns & Exchange'} titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 8, padding: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'return' ? '#4f46e5' : 'transparent', borderRadius: 6, overflow: 'hidden' }}
          onPress={() => setActiveTab('return')}
        >
          <Text adjustsFontSizeToFit numberOfLines={1} style={{ textAlign: 'center', fontSize: 13, color: activeTab === 'return' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold', width: '100%' }}>
            {isBN ? 'পণ্য ফেরত (Return)' : 'Sales Return'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'replace' ? '#4f46e5' : 'transparent', borderRadius: 6, overflow: 'hidden' }}
          onPress={() => setActiveTab('replace')}
        >
          <Text adjustsFontSizeToFit numberOfLines={1} style={{ textAlign: 'center', fontSize: 13, color: activeTab === 'replace' ? '#fff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 'bold', width: '100%' }}>
            {isBN ? 'পণ্য পরিবর্তন (Replace)' : 'Item Replace'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'return' ? (
          <>
            <Card style={{ padding: 16, backgroundColor: theme.colors.surface, marginBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                {isBN ? 'বারকোড, ইনভয়েস নং বা ফোন দিয়ে খুঁজুন' : 'Lookup by Barcode, Invoice # or Phone'}
              </Text>
              <TextInput
                mode="outlined"
                placeholder={isBN ? 'বারকোড, ইনভয়েস নং বা ফোন লিখুন...' : 'Enter barcode, invoice # or phone...'}
                value={barcode}
                onChangeText={setBarcode}
                left={<TextInput.Icon icon="magnify" />}
                right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('return')} />}
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />
              <Button mode="contained" buttonColor="#4f46e5" loading={loading} disabled={loading || !barcode} onPress={handleScanReturn}>
                {isBN ? 'বিক্রয় খুঁজুন' : 'Search Sale'}
              </Button>
            </Card>

            {scanResult && (
              <Card style={{ backgroundColor: theme.colors.surface, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 17 }}>{scanResult.product?.name || scanResult.product_name || 'Product'}</Text>
                  <View style={{
                    backgroundColor: '#16a34a',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: '#ffffff',
                      fontWeight: 'bold',
                      fontSize: 11,
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}>
                      {isBN ? 'বিক্রিত' : 'Sold'}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 4 }}>
                  {isBN ? 'ইনভয়েস নং:' : 'Invoice No:'} #{scanResult.sale?.invoice_no || scanResult.invoice_no || scanResult.sale}
                </Text>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 4 }}>
                  {isBN ? 'বিক্রয় মূল্য:' : 'Sold Price:'} ৳{Number(scanResult.unit_price || scanResult.price || 0).toFixed(2)}
                </Text>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12 }}>
                  {isBN ? 'গ্রাহক:' : 'Customer:'} {scanResult.sale?.customer_name || scanResult.customer_name || 'Walk-in'}
                </Text>

                <Divider style={{ marginVertical: 10 }} />

                <Text style={{ fontWeight: '600', marginBottom: 6 }}>
                  {isBN ? 'ফেরত নেওয়া পণ্যের অবস্থা' : 'Action on Item'}
                </Text>
                <SegmentedButtons
                  value={action}
                  onValueChange={v => setAction(v as any)}
                  buttons={[
                    { value: 'restock', label: isBN ? 'পুনরায় স্টকে যুক্ত (Restock)' : 'Restock' },
                    { value: 'scrap', label: isBN ? 'ড্যামেজ / নষ্ট (Scrap)' : 'Scrap / Damaged' },
                  ]}
                  style={{ marginBottom: 16 }}
                />

                <Text style={{ fontWeight: '600', marginBottom: 6 }}>
                  {isBN ? 'রিফান্ড মাধ্যম' : 'Refund Method'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {METHODS.map(m => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setRefundMethod(m.key)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                        borderWidth: 1, borderColor: refundMethod === m.key ? '#4f46e5' : '#ccc',
                        backgroundColor: refundMethod === m.key ? '#e0e7ff' : theme.colors.surface
                      }}
                    >
                      <Text style={{ fontSize: 12, color: refundMethod === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: refundMethod === m.key ? 'bold' : 'normal' }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Button mode="contained" buttonColor="#dc2626" loading={processing} disabled={processing} onPress={handleProcessReturn}>
                  {isBN ? 'ফেরত নিশ্চিত করুন' : 'Confirm Return'}
                </Button>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card style={{ padding: 16, backgroundColor: theme.colors.surface, marginBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                {isBN ? '১. পুরনো (ফেরত দেওয়া) পণ্যের বারকোড' : '1. Scan Original Sold Barcode'}
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Original Barcode..."
                value={oldBarcode}
                onChangeText={setOldBarcode}
                left={<TextInput.Icon icon="barcode" />}
                right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('old')} />}
                style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
              />
              <Button mode="contained" buttonColor="#4f46e5" loading={loading} disabled={loading || !oldBarcode} onPress={handleScanReplaceOld}>
                {isBN ? 'পুরনো পণ্য যাচাই করুন' : 'Verify Original'}
              </Button>
            </Card>

            {oldScanResult && (
              <Card style={{ padding: 16, backgroundColor: theme.colors.surface }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a', marginBottom: 4 }}>
                  ✓ {isBN ? 'যাচাইকৃত পণ্য:' : 'Verified Product:'} {oldScanResult.product?.name || oldScanResult.product_name}
                </Text>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 16 }}>
                  {isBN ? 'মূল্য:' : 'Price:'} ৳{Number(oldScanResult.unit_price || 0).toFixed(2)}
                </Text>

                <Divider style={{ marginVertical: 10 }} />

                <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                  {isBN ? '২. নতুন (প্রতিস্থাপন) পণ্যের বারকোড' : '2. Scan New Replacement Barcode'}
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="New Barcode..."
                  value={newBarcode}
                  onChangeText={setNewBarcode}
                  left={<TextInput.Icon icon="barcode" />}
                  right={<TextInput.Icon icon="barcode-scan" onPress={() => setScannerTarget('new')} />}
                  style={{ marginBottom: 16, backgroundColor: theme.colors.surface }}
                />

                <Button mode="contained" buttonColor="#16a34a" loading={processing} disabled={processing || !newBarcode} onPress={handleProcessReplace}>
                  {isBN ? 'প্রতিস্থাপন সম্পন্ন করুন' : 'Complete Replacement'}
                </Button>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <CameraBarcodeScannerModal
        visible={!!scannerTarget}
        onClose={() => setScannerTarget(null)}
        onScanned={(code) => {
          if (scannerTarget === 'return') {
            setBarcode(code);
          } else if (scannerTarget === 'old') {
            setOldBarcode(code);
          } else if (scannerTarget === 'new') {
            setNewBarcode(code);
          }
          setScannerTarget(null);
        }}
      />
    </View>
  );
}
