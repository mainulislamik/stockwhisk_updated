import React, { useEffect, useState } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Surface, useTheme, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

type FullProduct = {
  id: number; name: string; sku: string; selling_price: string; cost_price: string;
  current_stock: string; reorder_level?: string; is_low_stock?: boolean;
  is_active?: boolean; category?: number | null; category_name?: string;
};

type ProductUnit = {
  id: number;
  barcode: string;
  status: string;
  cost_price: string | null;
  selling_price: string | null;
  effective_cost_price: string;
  effective_selling_price: string;
  created_at: string;
  warranty_months?: number | null;
  effective_warranty_months?: number;
};

export default function ProductDetailModal({ visible, product, onClose }: { visible: boolean, product: FullProduct | null, onClose: () => void }) {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';
  
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ cost_price: '', selling_price: '', warranty_months: '' });

  useEffect(() => {
    if (visible && product) {
      loadUnits(product.id);
    } else {
      setUnits([]);
      setEditingUnit(null);
    }
  }, [visible, product]);

  const loadUnits = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get('/catalog/product-units/', { params: { product: id, status: 'in_stock' } });
      setUnits(res.data?.results || res.data || []);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  const startEditing = (u: ProductUnit) => {
    setEditingUnit(u.id);
    setEditForm({
      cost_price: u.cost_price?.toString() || u.effective_cost_price?.toString() || '',
      selling_price: u.selling_price?.toString() || u.effective_selling_price?.toString() || '',
      warranty_months: u.warranty_months?.toString() || u.effective_warranty_months?.toString() || '',
    });
  };

  const saveUnit = async (u: ProductUnit) => {
    try {
      const data = {
        cost_price: editForm.cost_price ? Number(editForm.cost_price) : null,
        selling_price: editForm.selling_price ? Number(editForm.selling_price) : null,
        warranty_months: editForm.warranty_months ? Number(editForm.warranty_months) : null,
      };
      await api.patch(`/catalog/product-units/${u.id}/`, data);
      await loadUnits(product!.id);
      setEditingUnit(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (!product) return null;

  const totalCostValue = Number(product.cost_price || 0) * Math.max(0, Number(product.current_stock || 0));
  const totalSellValue = Number(product.selling_price || 0) * Math.max(0, Number(product.current_stock || 0));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#2563eb' }}>{product.name}</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>SKU {product.sku}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={28} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
            
            <Surface style={{ width: '48%', padding: 16, borderRadius: 12, marginBottom: 12, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{isBN ? 'মোট ক্রয় মূল্য' : 'Total Cost Value'}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>৳{totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Surface>
            
            <Surface style={{ width: '48%', padding: 16, borderRadius: 12, marginBottom: 12, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{isBN ? 'মোট খুচরা মূল্য' : 'Total Retail Value'}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>৳{totalSellValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Surface>
            
            <Surface style={{ width: '48%', padding: 16, borderRadius: 12, marginBottom: 12, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{isBN ? 'স্টকে আছে' : 'In Stock'}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a' }}>{Math.max(0, Number(product.current_stock || 0)).toFixed(0)}</Text>
            </Surface>
            
            <Surface style={{ width: '48%', padding: 16, borderRadius: 12, marginBottom: 12, backgroundColor: theme.colors.surface, elevation: 1 }}>
              <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{isBN ? 'রিঅর্ডার লেভেল' : 'Reorder Level'}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#f59e0b' }}>{product.reorder_level || '0'}</Text>
            </Surface>

          </View>

          {/* Units Table */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name="package-variant" size={20} color="#2563eb" style={{ marginRight: 8 }} />
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2563eb' }}>{isBN ? 'প্রতিটি ইউনিট (স্টকে আছে)' : 'Each Unit (In Stock)'}</Text>
          </View>

          <Surface style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.surface, elevation: 2 }}>
            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : units.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#64748b' }}>{isBN ? 'স্টকে কোনো ইউনিট নেই' : 'No units in stock'}</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Table Header */}
                  <View style={{ flexDirection: 'row', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <Text style={{ width: 100, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'গ্রহণের তারিখ' : 'Date'}</Text>
                    <Text style={{ width: 150, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'বারকোড / সিরিয়াল' : 'Barcode/Serial'}</Text>
                    <Text style={{ width: 100, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'ক্রয় মূল্য' : 'Cost Price'}</Text>
                    <Text style={{ width: 100, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'বিক্রয় মূল্য' : 'Selling Price'}</Text>
                    <Text style={{ width: 120, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'ওয়ারেন্টি (মাস)' : 'Warranty (mo)'}</Text>
                    <Text style={{ width: 80, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12 }}>{isBN ? 'স্ট্যাটাস' : 'Status'}</Text>
                    <Text style={{ width: 80, paddingHorizontal: 12, fontWeight: 'bold', color: '#64748b', fontSize: 12, textAlign: 'center' }}>{isBN ? 'অ্যাকশন' : 'Action'}</Text>
                  </View>

                  {/* Table Rows */}
                  {units.map((u, i) => (
                    <View key={u.id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9', backgroundColor: i % 2 === 0 ? 'transparent' : (isDarkMode ? '#0f172a' : '#fafafa'), alignItems: 'center' }}>
                      <Text style={{ width: 100, paddingHorizontal: 12, fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#334155' }}>{new Date(u.created_at).toLocaleDateString()}</Text>
                      <View style={{ width: 150, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
                         <MaterialCommunityIcons name="barcode" size={14} color="#64748b" style={{ marginRight: 4 }} />
                         <Text style={{ fontSize: 12, fontFamily: 'monospace', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{u.barcode}</Text>
                      </View>

                      {editingUnit === u.id ? (
                        <>
                          <View style={{ width: 100, paddingHorizontal: 8 }}>
                             <TextInput mode="outlined" style={{ height: 30, fontSize: 12 }} dense keyboardType="numeric" value={editForm.cost_price} onChangeText={t => setEditForm(f => ({...f, cost_price: t}))} />
                          </View>
                          <View style={{ width: 100, paddingHorizontal: 8 }}>
                             <TextInput mode="outlined" style={{ height: 30, fontSize: 12 }} dense keyboardType="numeric" value={editForm.selling_price} onChangeText={t => setEditForm(f => ({...f, selling_price: t}))} />
                          </View>
                          <View style={{ width: 120, paddingHorizontal: 8 }}>
                             <TextInput mode="outlined" style={{ height: 30, fontSize: 12 }} dense keyboardType="numeric" value={editForm.warranty_months} onChangeText={t => setEditForm(f => ({...f, warranty_months: t}))} />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={{ width: 100, paddingHorizontal: 12, fontSize: 12, color: '#64748b' }}>৳{Number(u.effective_cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                          <Text style={{ width: 100, paddingHorizontal: 12, fontSize: 12, fontWeight: 'bold', color: '#2563eb' }}>৳{Number(u.effective_selling_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                          <Text style={{ width: 120, paddingHorizontal: 12, fontSize: 12, textAlign: 'center', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{u.effective_warranty_months || '-'}</Text>
                        </>
                      )}

                      <View style={{ width: 80, paddingHorizontal: 12 }}>
                        <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                          <Text style={{ color: '#16a34a', fontSize: 10, fontWeight: 'bold' }}>In Stock</Text>
                        </View>
                      </View>

                      <View style={{ width: 80, paddingHorizontal: 12, alignItems: 'center' }}>
                        {editingUnit === u.id ? (
                           <View style={{ flexDirection: 'row' }}>
                             <TouchableOpacity onPress={() => saveUnit(u)} style={{ marginRight: 8 }}><MaterialCommunityIcons name="check-circle" size={20} color="#16a34a" /></TouchableOpacity>
                             <TouchableOpacity onPress={() => setEditingUnit(null)}><MaterialCommunityIcons name="close-circle" size={20} color="#ef4444" /></TouchableOpacity>
                           </View>
                        ) : (
                           <TouchableOpacity onPress={() => startEditing(u)}>
                             <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: 'bold' }}>{isBN ? 'এডিট' : 'Edit'}</Text>
                           </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </Surface>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}