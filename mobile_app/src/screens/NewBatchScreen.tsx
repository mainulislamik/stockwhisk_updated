import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, useTheme, Button, Divider, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

type Product = {
  id: number;
  name: string;
  sku: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  unit_detail?: { name: string; symbol: string; measure_type: string };
};

type MaterialRow = {
  product_id: string;
  quantity: string;
  unit_cost: string;
};

export default function NewBatchScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState('');
  const [additionalCost, setAdditionalCost] = useState('0');
  const [additionalCostNote, setAdditionalCostNote] = useState('');

  const [rows, setRows] = useState<MaterialRow[]>([
    { product_id: '', quantity: '1', unit_cost: '0' },
  ]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/catalog/products/?page_size=500');
      const data = res.data?.results || res.data || [];
      setProducts(data);
      if (data.length > 0 && rows.length === 1 && !rows[0].product_id) {
        setRows([{ product_id: String(data[0].id), quantity: '1', unit_cost: data[0].cost_price || '0' }]);
      }
    } catch (e: any) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => String(p.id) === prodId);
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      product_id: prodId,
      unit_cost: prod ? String(prod.cost_price || 0) : '0',
    };
    setRows(updated);
  };

  const handleQtyChange = (index: number, qty: string) => {
    const updated = [...rows];
    updated[index].quantity = qty;
    setRows(updated);
  };

  const handleCostChange = (index: number, cost: string) => {
    const updated = [...rows];
    updated[index].unit_cost = cost;
    setRows(updated);
  };

  const addRow = () => {
    const defaultProd = products[0];
    setRows([
      ...rows,
      {
        product_id: defaultProd ? String(defaultProd.id) : '',
        quantity: '1',
        unit_cost: defaultProd ? String(defaultProd.cost_price || 0) : '0',
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'কমপক্ষে একটি কাঁচামাল থাকা আবশ্যক।' : 'At least one material is required.');
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const totalMaterialCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unit_cost) || 0;
      return sum + q * c;
    }, 0);
  }, [rows]);

  const grandTotalCost = useMemo(() => {
    return totalMaterialCost + (Number(additionalCost) || 0);
  }, [totalMaterialCost, additionalCost]);

  const handleSubmit = async () => {
    const validMaterials = rows
      .filter((r) => r.product_id && Number(r.quantity) > 0)
      .map((r) => ({
        product_id: Number(r.product_id),
        quantity: Number(r.quantity),
        unit_cost: Number(r.unit_cost),
      }));

    if (validMaterials.length === 0) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'অনুগ্রহ করে অন্তত একটি কাঁচামাল এবং তার পরিমাণ দিন।' : 'Please add at least one material.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/manufacturing/batches/', {
        materials: validMaterials,
        notes,
        additional_cost: Number(additionalCost) || 0,
        additional_cost_note: additionalCostNote,
      });
      Alert.alert(
        isBN ? 'সফল 🎉' : 'Success 🎉',
        isBN ? `ব্যাচ #${res.data?.batch_number} শুরু হয়েছে এবং কাঁচামাল স্টক থেকে কাটা হয়েছে!` : `Batch #${res.data?.batch_number} started & materials deducted!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e?.response?.data?.detail || 'Failed to start batch.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface, elevation: 1 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'নতুন ব্যাচ শুরু (WIP)' : 'Start Production Batch'} titleStyle={{ fontWeight: '800', fontSize: 17 }} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Helper Note */}
        <Surface style={{ padding: 12, borderRadius: 14, backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' }}>
          <Text style={{ fontSize: 12, color: '#1e40af', lineHeight: 18 }}>
            💡 {isBN ? 'ধাপ ১: কাঁচামাল নির্বাচন করে ব্যাচ শুরু করুন। কাঁচামাল স্বয়ংক্রিয়ভাবে স্টক থেকে কাটা হবে।' : 'Step 1: Commit raw materials. Stock will be deducted automatically upon starting.'}
          </Text>
        </Surface>

        {/* Raw Materials Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.onSurface }}>
            {isBN ? 'ব্যবহৃত কাঁচামালসমূহ' : 'Raw Materials to Use'}
          </Text>
          <Button mode="outlined" compact onPress={addRow} textColor="#4f46e5" style={{ borderRadius: 10 }}>
            {isBN ? '+ উপাদান যোগ' : '+ Add Item'}
          </Button>
        </View>

        {rows.map((row, idx) => {
          const prod = products.find((p) => String(p.id) === row.product_id);
          const sub = (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0);

          return (
            <Card key={idx} style={{ marginBottom: 12, borderRadius: 16, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <Card.Content style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b' }}>#{idx + 1} {isBN ? 'কাঁচামাল' : 'Material'}</Text>
                  {rows.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(idx)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Product horizontal picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {products.slice(0, 15).map((p) => (
                      <Chip
                        key={p.id}
                        selected={row.product_id === String(p.id)}
                        onPress={() => handleProductChange(idx, String(p.id))}
                        style={{ backgroundColor: row.product_id === String(p.id) ? '#4f46e5' : (isDarkMode ? '#1e293b' : '#f1f5f9') }}
                        textStyle={{ color: row.product_id === String(p.id) ? '#fff' : theme.colors.onSurface, fontSize: 11, fontWeight: '700' }}
                      >
                        {p.name} ({p.current_stock})
                      </Chip>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  <TextInput
                    mode="outlined"
                    label={isBN ? 'পরিমাণ' : 'Quantity'}
                    keyboardType="numeric"
                    value={row.quantity}
                    onChangeText={(t) => handleQtyChange(idx, t)}
                    style={{ flex: 1, backgroundColor: theme.colors.surface, height: 42 }}
                    dense
                  />
                  <TextInput
                    mode="outlined"
                    label={isBN ? 'একক খরচ (৳)' : 'Unit Cost (৳)'}
                    keyboardType="numeric"
                    value={row.unit_cost}
                    onChangeText={(t) => handleCostChange(idx, t)}
                    style={{ flex: 1, backgroundColor: theme.colors.surface, height: 42 }}
                    dense
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    {isBN ? 'স্টক: ' : 'Stock: '}
                    <Text style={{ fontWeight: '700', color: '#16a34a' }}>{prod?.current_stock || '0'} {prod?.unit_detail?.name || ''}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#4f46e5' }}>
                    ৳{sub.toFixed(2)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        })}

        {/* Total Material Investment */}
        <Surface style={{ padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', marginBottom: 16, elevation: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>{isBN ? 'কাঁচামালে মোট বিনিয়োগ:' : 'Total Raw Material Cost:'}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#4f46e5' }}>৳{totalMaterialCost.toFixed(2)}</Text>
          </View>
        </Surface>

        {/* Additional Overheads & Formula */}
        <Card style={{ marginBottom: 16, borderRadius: 16, backgroundColor: theme.colors.surface, elevation: 1 }}>
          <Card.Content style={{ padding: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, marginBottom: 10 }}>
              {isBN ? 'অতিরিক্ত খরচ ও রেসিপি নোট (ঐচ্ছিক)' : 'Additional Overheads & Recipe'}
            </Text>

            <TextInput
              mode="outlined"
              label={isBN ? 'আনুমানিক অতিরিক্ত খরচ (লেবার/বিদ্যুৎ) ৳' : 'Estimated Extra Cost ৳'}
              keyboardType="numeric"
              value={additionalCost}
              onChangeText={setAdditionalCost}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />

            <TextInput
              mode="outlined"
              label={isBN ? 'অতিরিক্ত খরচের বিবরণ' : 'Extra Cost Note'}
              value={additionalCostNote}
              onChangeText={setAdditionalCostNote}
              placeholder={isBN ? 'যেমন: প্লাস্টিক বোতল + লেবার' : 'e.g. Bottles & Fuel'}
              style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}
            />

            <TextInput
              mode="outlined"
              label={isBN ? 'ব্যাচ নোট / উৎপাদনের ফর্মুলা' : 'Batch Notes / Formula'}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              placeholder={isBN ? 'যেমন: ফর্মুলা বি-১২ রোজ ফ্লেভার' : 'e.g. Formula B-12 Rose'}
              style={{ backgroundColor: theme.colors.surface }}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <Surface style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0', elevation: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>{isBN ? 'মোট সম্ভাব্য ব্যাচ খরচ:' : 'Grand Total Cost:'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16a34a' }}>৳{grandTotalCost.toFixed(2)}</Text>
        </View>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={busy}
          disabled={busy || rows.length === 0}
          buttonColor="#4f46e5"
          style={{ borderRadius: 14, paddingVertical: 4 }}
        >
          {isBN ? '🚀 ব্যাচ শুরু করুন ও কাঁচামাল কর্তন' : '🚀 Start Batch (Deduct Materials)'}
        </Button>
      </Surface>
    </View>
  );
}
