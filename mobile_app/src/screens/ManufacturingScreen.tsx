import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Appbar, Text, Card, TextInput, Chip, useTheme, FAB, Button, Divider, Surface } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';

type ProductionMaterial = {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_name: string;
  unit_cost: string;
  subtotal: string;
};

type ProductionBatch = {
  id: number;
  batch_number: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  total_material_cost: string;
  additional_cost: string;
  additional_cost_note: string;
  total_cost: string;
  output_product: number | null;
  output_product_name: string | null;
  output_product_sku: string | null;
  output_unit_name: string | null;
  output_product_selling_price: string;
  output_quantity: string;
  calculated_unit_cost: string;
  notes: string;
  materials: ProductionMaterial[];
};

type SummaryStats = {
  in_progress_count: number;
  completed_count: number;
  total_units_produced: string;
  total_material_cost_utilized: string;
};

export default function ManufacturingScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');

  // Modals state
  const [viewBatch, setViewBatch] = useState<ProductionBatch | null>(null);
  const [completeBatch, setCompleteBatch] = useState<ProductionBatch | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [outputQty, setOutputQty] = useState<string>('');
  const [extraCost, setExtraCost] = useState<string>('0');
  const [extraCostNote, setExtraCostNote] = useState<string>('');
  const [completing, setCompleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bRes, sRes, pRes] = await Promise.all([
        api.get('/manufacturing/batches/'),
        api.get('/manufacturing/batches/summary/').catch(() => ({ data: null })),
        api.get('/catalog/products/?page_size=300').catch(() => ({ data: [] })),
      ]);
      setBatches(bRes.data?.results || bRes.data || []);
      setSummary(sRes.data);
      setProducts(pRes.data?.results || pRes.data || []);
    } catch (e: any) {
      console.log('Error loading manufacturing batches:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCancelBatch = (batch: ProductionBatch) => {
    Alert.alert(
      isBN ? 'ব্যাচ বাতিল' : 'Cancel Batch',
      isBN ? `আপনি কি নিশ্চিত যে ব্যাচ #${batch.batch_number} বাতিল করবেন? কাঁচামাল স্টকে ফেরত যাবে।` : `Cancel batch #${batch.batch_number}? Raw materials will be returned to stock.`,
      [
        { text: isBN ? 'না' : 'No', style: 'cancel' },
        {
          text: isBN ? 'হ্যাঁ, বাতিল করুন' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/manufacturing/batches/${batch.id}/cancel/`);
              Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'ব্যাচ বাতিল করা হয়েছে।' : 'Batch cancelled.');
              loadData();
            } catch (e: any) {
              Alert.alert(isBN ? 'ত্রুটি' : 'Error', e?.response?.data?.detail || 'Failed to cancel batch.');
            }
          },
        },
      ]
    );
  };

  const handleCompleteBatch = async () => {
    if (!completeBatch) return;
    if (!selectedProductId) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'অনুগ্রহ করে চূড়ান্ত উৎপাদিত পণ্য নির্বাচন করুন।' : 'Please select the finished product.');
      return;
    }
    const q = Number(outputQty);
    if (!q || q <= 0) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? 'অনুগ্রহ করে উৎপাদিত সঠিক পরিমাণ দিন।' : 'Please enter a valid finished quantity.');
      return;
    }

    setCompleting(true);
    try {
      await api.post(`/manufacturing/batches/${completeBatch.id}/complete/`, {
        output_product: Number(selectedProductId),
        output_quantity: q,
        additional_cost: Number(extraCost) || 0,
        additional_cost_note: extraCostNote,
        update_product_cost: true,
      });
      Alert.alert(isBN ? 'অভিনন্দন 🎉' : 'Success 🎉', isBN ? 'ব্যাচ সম্পন্ন হয়েছে এবং স্টক যুক্ত হয়েছে!' : 'Batch completed and finished stock added!');
      setCompleteBatch(null);
      loadData();
    } catch (e: any) {
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', e?.response?.data?.detail || 'Failed to complete batch.');
    } finally {
      setCompleting(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.batch_number.toLowerCase().includes(q) ||
      (b.output_product_name && b.output_product_name.toLowerCase().includes(q)) ||
      (b.materials && b.materials.some((m) => m.product_name.toLowerCase().includes(q)));
    return matchStatus && matchSearch;
  });

  const calculatedYieldUnitCost = () => {
    if (!completeBatch) return '0.00';
    const totalMat = Number(completeBatch.total_material_cost) || 0;
    const addCost = Number(extraCost) || 0;
    const q = Number(outputQty) || 0;
    if (q <= 0) return '0.00';
    return ((totalMat + addCost) / q).toFixed(2);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface, elevation: 1 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'ম্যানুফ্যাকচারিং হাব' : 'Manufacturing Hub'} titleStyle={{ fontWeight: '800', fontSize: 18 }} />
        <Appbar.Action icon="plus-circle" onPress={() => navigation.navigate('NewBatchScreen')} color="#4f46e5" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Summary Stats Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <Surface style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? '#1e293b' : '#fff', elevation: 1, borderLeftWidth: 4, borderLeftColor: '#f59e0b' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>{isBN ? 'চলমান ব্যাচ (WIP)' : 'Active Batches (WIP)'}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#f59e0b' }}>{summary?.in_progress_count ?? 0}</Text>
          </Surface>
          <Surface style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? '#1e293b' : '#fff', elevation: 1, borderLeftWidth: 4, borderLeftColor: '#10b981' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>{isBN ? 'সম্পন্ন ব্যাচ' : 'Completed Batches'}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#10b981' }}>{summary?.completed_count ?? 0}</Text>
          </Surface>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <Surface style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? '#1e293b' : '#fff', elevation: 1, borderLeftWidth: 4, borderLeftColor: '#6366f1' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>{isBN ? 'মোট উৎপাদিত ইউনিট' : 'Total Finished Units'}</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#4f46e5' }}>{Number(summary?.total_units_produced || 0).toLocaleString()}</Text>
          </Surface>
          <Surface style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? '#1e293b' : '#fff', elevation: 1, borderLeftWidth: 4, borderLeftColor: '#0ea5e9' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>{isBN ? 'ব্যবহৃত কাঁচামাল খরচ' : 'Raw Material Utilized'}</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0ea5e9' }}>৳{Number(summary?.total_material_cost_utilized || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Surface>
        </View>

        {/* Search & Filter */}
        <TextInput
          mode="outlined"
          placeholder={isBN ? 'ব্যাচ # বা পণ্য দিয়ে খুঁজুন...' : 'Search batch # or product...'}
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          style={{ marginBottom: 12, backgroundColor: theme.colors.surface, height: 44 }}
          outlineStyle={{ borderRadius: 12, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'in_progress', 'completed', 'cancelled'] as const).map((st) => (
              <Chip
                key={st}
                selected={filterStatus === st}
                onPress={() => setFilterStatus(st)}
                style={{ backgroundColor: filterStatus === st ? '#4f46e5' : theme.colors.surface }}
                textStyle={{ color: filterStatus === st ? '#fff' : theme.colors.onSurface, fontWeight: '700', fontSize: 12 }}
              >
                {st === 'all'
                  ? (isBN ? 'সকল ব্যাচ' : 'All')
                  : st === 'in_progress'
                  ? (isBN ? 'চলমান ⏳' : 'WIP ⏳')
                  : st === 'completed'
                  ? (isBN ? 'সম্পন্ন ✅' : 'Completed ✅')
                  : (isBN ? 'বাতিল ❌' : 'Cancelled ❌')}
              </Chip>
            ))}
          </View>
        </ScrollView>

        {/* Batch Cards */}
        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
        ) : filteredBatches.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
            <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600' }}>{isBN ? 'কোনো প্রোডাকশন ব্যাচ পাওয়া যায়নি।' : 'No production batches found.'}</Text>
          </View>
        ) : (
          filteredBatches.map((b) => {
            const isWip = b.status === 'in_progress';
            const isDone = b.status === 'completed';
            const isCancel = b.status === 'cancelled';

            return (
              <Card key={b.id} style={{ marginBottom: 14, borderRadius: 16, backgroundColor: theme.colors.surface, elevation: 1, borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                <Card.Content style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: '#4f46e5', fontFamily: 'monospace' }}>#{b.batch_number}</Text>
                      <View
                        style={{
                          backgroundColor: isWip ? '#fef3c7' : isDone ? '#dcfce7' : '#fee2e2',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isWip ? '#d97706' : isDone ? '#16a34a' : '#dc2626' }}>
                          {isWip ? (isBN ? 'প্রক্রিয়াধীন ⏳' : 'WIP') : isDone ? (isBN ? 'সম্পন্ন ✅' : 'COMPLETED') : (isBN ? 'বাতিল' : 'CANCELLED')}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>{new Date(b.started_at).toLocaleDateString()}</Text>
                  </View>

                  <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: '700' }}>{isBN ? 'ব্যবহৃত কাঁচামাল:' : 'Raw Materials Used:'}</Text>
                    {b.materials && b.materials.map((m) => (
                      <Text key={m.id} style={{ fontSize: 12, color: theme.colors.onSurface, marginBottom: 2 }}>
                        • {m.product_name} ({Number(m.quantity)} {m.unit_name || (isBN ? 'একক' : 'Unit')}) — ৳{Number(m.subtotal).toFixed(2)}
                      </Text>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{isBN ? 'মোট কাঁচামাল খরচ' : 'Total Material Cost'}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>৳{Number(b.total_material_cost).toFixed(2)}</Text>
                    </View>
                    {isDone && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{isBN ? 'উৎপাদিত ফলন' : 'Finished Output'}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#16a34a' }}>
                          {Number(b.output_quantity)} {b.output_unit_name || (isBN ? 'ইউনিট' : 'Units')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingTop: 10 }}>
                    <Button mode="outlined" compact onPress={() => setViewBatch(b)} textColor="#64748b" style={{ borderRadius: 10 }}>
                      {isBN ? 'বিস্তারিত' : 'Details'}
                    </Button>
                    {isWip && (
                      <>
                        <Button mode="outlined" compact onPress={() => handleCancelBatch(b)} textColor="#ef4444" style={{ borderRadius: 10, borderColor: '#fca5a5' }}>
                          {isBN ? 'বাতিল' : 'Cancel'}
                        </Button>
                        <Button mode="contained" compact onPress={() => { setCompleteBatch(b); setSelectedProductId(''); setOutputQty(''); setExtraCost('0'); setExtraCostNote(''); }} buttonColor="#4f46e5" style={{ borderRadius: 10 }}>
                          {isBN ? 'উৎপাদন এন্ট্রি' : 'Enter Yield'}
                        </Button>
                      </>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Enter Yield Modal */}
      <Modal visible={!!completeBatch} transparent animationType="slide" onRequestClose={() => setCompleteBatch(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setCompleteBatch(null)} />
        <View style={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, position: 'absolute', bottom: 0, width: '100%', maxHeight: '88%', padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: '#4f46e5' }}>
              {isBN ? `উৎপাদন এন্ট্রি ও স্টক ইনওয়ার্ড (#${completeBatch?.batch_number})` : `Enter Yield & Finish (#${completeBatch?.batch_number})`}
            </Text>
            <TouchableOpacity onPress={() => setCompleteBatch(null)}>
              <MaterialCommunityIcons name="close-circle" size={26} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>{isBN ? 'চূড়ান্ত উৎপাদিত পণ্য নির্বাচন করুন *' : 'Select Finished Product *'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {products.map((p) => (
                  <Chip
                    key={p.id}
                    selected={selectedProductId === String(p.id)}
                    onPress={() => setSelectedProductId(String(p.id))}
                    style={{ backgroundColor: selectedProductId === String(p.id) ? '#4f46e5' : theme.colors.surface }}
                    textStyle={{ color: selectedProductId === String(p.id) ? '#fff' : theme.colors.onSurface, fontWeight: '700', fontSize: 11 }}
                  >
                    {p.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <TextInput
              mode="outlined"
              label={isBN ? 'উৎপাদিত পরিমাণ (Quantity) *' : 'Produced Output Qty *'}
              keyboardType="numeric"
              value={outputQty}
              onChangeText={setOutputQty}
              placeholder="e.g. 50"
              style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
            />

            <TextInput
              mode="outlined"
              label={isBN ? 'অতিরিক্ত খরচ (লেবার/প্যাকেজিং) ৳' : 'Extra Cost (Labor/Packing) ৳'}
              keyboardType="numeric"
              value={extraCost}
              onChangeText={setExtraCost}
              style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
            />

            <TextInput
              mode="outlined"
              label={isBN ? 'অতিরিক্ত খরচের নোট' : 'Extra Cost Note'}
              value={extraCostNote}
              onChangeText={setExtraCostNote}
              placeholder={isBN ? 'যেমন: ৫০টি বোতল + মজুরি' : 'e.g. Bottles + Labor'}
              style={{ marginBottom: 16, backgroundColor: theme.colors.surface }}
            />

            {/* Calculated Yield Preview */}
            <Surface style={{ padding: 14, borderRadius: 14, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', marginBottom: 20, borderWidth: 1, borderColor: '#86efac' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#166534', fontWeight: '700' }}>{isBN ? 'গণনাকৃত প্রতি ইউনিট খরচ:' : 'Calculated Unit Cost:'}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a' }}>৳{calculatedYieldUnitCost()}</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#166534' }}>{isBN ? 'ক্যাটালগে স্বয়ংক্রিয়ভাবে ক্রয়মূল্য আপডেট হবে।' : 'Catalog cost price will be updated automatically.'}</Text>
            </Surface>

            <Button mode="contained" onPress={handleCompleteBatch} loading={completing} disabled={completing} buttonColor="#4f46e5" style={{ borderRadius: 12, paddingVertical: 4 }}>
              {isBN ? 'ব্যাচ সম্পন্ন করুন ও স্টক যোগ করুন' : 'Complete Batch & Receive Stock'}
            </Button>
          </ScrollView>
        </View>
      </Modal>

      {/* Batch Details Modal */}
      <Modal visible={!!viewBatch} transparent animationType="slide" onRequestClose={() => setViewBatch(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setViewBatch(null)} />
        <View style={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, position: 'absolute', bottom: 0, width: '100%', maxHeight: '85%', padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#4f46e5' }}>
              {isBN ? `প্রোডাকশন ব্যাচের বিবরণ #${viewBatch?.batch_number}` : `Batch Details #${viewBatch?.batch_number}`}
            </Text>
            <TouchableOpacity onPress={() => setViewBatch(null)}>
              <MaterialCommunityIcons name="close-circle" size={26} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {viewBatch && (
              <>
                <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>{isBN ? 'স্টক থেকে কর্তনকৃত কাঁচামাল:' : 'Raw Materials Deducted:'}</Text>
                  {viewBatch.materials.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurface, flex: 1 }}>{m.product_name}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#4f46e5' }}>{Number(m.quantity)} {m.unit_name || (isBN ? 'একক' : 'Unit')}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginLeft: 12 }}>৳{Number(m.subtotal).toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>{isBN ? 'মোট কাঁচামাল খরচ:' : 'Total Material Cost:'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#4f46e5' }}>৳{Number(viewBatch.total_material_cost).toFixed(2)}</Text>
                  </View>
                </View>

                {viewBatch.status === 'completed' && (
                  <View style={{ backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534', marginBottom: 4 }}>{isBN ? 'চূড়ান্ত উৎপাদিত পণ্য:' : 'Finished Output Product:'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>{viewBatch.output_product_name}</Text>
                    <Text style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                      {isBN ? 'উৎপাদিত পরিমাণ: ' : 'Produced Qty: '}{Number(viewBatch.output_quantity)} {viewBatch.output_unit_name || (isBN ? 'ইউনিট' : 'Units')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#166534' }}>
                      {isBN ? 'একক উৎপাদন খরচ: ' : 'Calculated Unit Cost: '}৳{Number(viewBatch.calculated_unit_cost).toFixed(2)}
                    </Text>
                  </View>
                )}

                {viewBatch.notes ? (
                  <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>{isBN ? 'নোট / রেসিপি:' : 'Notes / Formula:'}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurface, marginTop: 2 }}>{viewBatch.notes}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Floating Action Button for New Batch */}
      <FAB
        icon="plus"
        label={isBN ? 'নতুন ব্যাচ' : 'New Batch'}
        style={{ position: 'absolute', bottom: 20, right: 16, backgroundColor: '#4f46e5' }}
        color="#ffffff"
        onPress={() => navigation.navigate('NewBatchScreen')}
      />
    </View>
  );
}
