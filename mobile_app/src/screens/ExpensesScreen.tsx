import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Appbar, Text, Card, TextInput, ActivityIndicator, useTheme, Button, Menu, FAB } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

export default function ExpensesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBn = language === 'BN';
  
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState('0.00');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({
    category: '',
    category_name: '',
    amount: '',
    spent_on: new Date().toISOString().slice(0, 10),
    payment_method: 'CASH',
    note: ''
  });
  
  const [catMenuVisible, setCatMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      setCreatingCat(true);
      const res = await api.post('/accounting/expense-categories/', { name: newCatName.trim() });
      const created = res.data;
      setCategories(prev => [...prev, created]);
      setForm(prev => ({ ...prev, category: created.id, category_name: created.name }));
      setNewCatName('');
      setShowAddCatModal(false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setCreatingCat(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [totalRes, catRes, expRes] = await Promise.all([
        api.get('/accounting/expenses/total/'),
        api.get('/accounting/expense-categories/'),
        api.get('/accounting/expenses/?page=1&page_size=20')
      ]);
      setTotal(totalRes.data.total || '0.00');
      setCategories(catRes.data?.results || catRes.data || []);
      setExpenses(expRes.data.results || []);
      setHasMore(!!expRes.data.next);
      setPage(2);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const res = await api.get('/accounting/expenses/?page=' + page + '&page_size=20');
      setExpenses(prev => [...prev, ...(res.data.results || [])]);
      setHasMore(!!res.data.next);
      setPage(p => p + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const saveExpense = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    try {
      setSaving(true);
      await api.post('/accounting/expenses/', {
        category: form.category || null,
        amount: form.amount,
        spent_on: form.spent_on,
        payment_method: form.payment_method,
        note: form.note
      });
      setForm({
        category: '', category_name: '', amount: '',
        spent_on: new Date().toISOString().slice(0, 10),
        payment_method: 'CASH', note: ''
      });
      setShowForm(false);
      setPage(1);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      loadMore();
    }
  };

  const METHODS = [
    { key: 'CASH', label: isBn ? 'ক্যাশ' : 'Cash' },
    { key: 'BKASH', label: 'bKash' },
    { key: 'NAGAD', label: 'Nagad' },
    { key: 'BANK', label: isBn ? 'ব্যাংক' : 'Bank' },
    { key: 'CARD', label: isBn ? 'কার্ড' : 'Card' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <PageGuideButton pageKey="/app/expenses" />
        <Appbar.Content title={isBn ? "খরচ ও ব্যয়" : "Expenses"} titleStyle={{ fontWeight: 'bold' }} />
        <Appbar.Action icon={showForm ? "close" : "plus"} onPress={() => setShowForm(!showForm)} />
      </Appbar.Header>
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Card style={[styles.card, { backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }]}>
            <Card.Content style={styles.rowBetween}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#dc2626' }}>
                {isBn ? 'মোট খরচ' : 'Total Expenses'}
              </Text>
              <Text variant="headlineSmall" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                ৳ {Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Card.Content>
          </Card>

          {showForm && (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface, elevation: 3 }]}>
              <Card.Content>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
                  {isBn ? 'নতুন খরচ যোগ করুন' : 'Add New Expense'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Menu
                      visible={catMenuVisible}
                      onDismiss={() => setCatMenuVisible(false)}
                      anchor={
                        <Button mode="outlined" onPress={() => setCatMenuVisible(true)} style={{ borderColor: '#ccc' }}>
                          {form.category_name || (isBn ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
                        </Button>
                      }
                    >
                      <Menu.Item onPress={() => { setForm({ ...form, category: '', category_name: isBn ? 'সাধারণ / ক্যাটাগরি ছাড়া' : 'None' }); setCatMenuVisible(false); }} title={isBn ? 'সাধারণ / ক্যাটাগরি ছাড়া' : 'None'} />
                      {categories.map(c => (
                        <Menu.Item key={c.id} onPress={() => { setForm({ ...form, category: c.id, category_name: c.name }); setCatMenuVisible(false); }} title={c.name} />
                      ))}
                    </Menu>
                  </View>
                  <Button mode="contained-tonal" icon="plus" onPress={() => setShowAddCatModal(true)}>
                    {isBn ? 'নতুন' : 'New'}
                  </Button>
                </View>

                <TextInput 
                  label={isBn ? "টাকার পরিমাণ (৳) *" : "Amount (৳) *"} 
                  value={form.amount} 
                  onChangeText={t => setForm({ ...form, amount: t })} 
                  keyboardType="numeric" 
                  style={[styles.input, { backgroundColor: theme.colors.surface }]} 
                  mode="outlined" 
                />
                <TextInput 
                  label={isBn ? "তারিখ (YYYY-MM-DD)" : "Date (YYYY-MM-DD)"} 
                  value={form.spent_on} 
                  onChangeText={t => setForm({ ...form, spent_on: t })} 
                  style={[styles.input, { backgroundColor: theme.colors.surface }]} 
                  mode="outlined" 
                />
                
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  {isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {METHODS.map(m => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setForm({ ...form, payment_method: m.key })}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                        borderWidth: 1, borderColor: form.payment_method === m.key ? '#4f46e5' : '#ccc',
                        backgroundColor: form.payment_method === m.key ? '#e0e7ff' : theme.colors.surface
                      }}
                    >
                      <Text style={{ fontSize: 12, color: form.payment_method === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: form.payment_method === m.key ? 'bold' : 'normal' }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <TextInput 
                  label={isBn ? "নোট / বিবরণ" : "Note / Description"} 
                  value={form.note} 
                  onChangeText={t => setForm({ ...form, note: t })} 
                  style={[styles.input, { backgroundColor: theme.colors.surface }]} 
                  mode="outlined" 
                />
                
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <Button onPress={() => setShowForm(false)}>{isBn ? 'বাতিল' : 'Cancel'}</Button>
                  <Button mode="contained" buttonColor="#4f46e5" onPress={saveExpense} loading={saving} disabled={saving || !form.amount}>
                    {isBn ? 'সেভ করুন' : 'Save Expense'}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {expenses.map(exp => (
            <Card key={exp.id} style={[styles.expenseCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{exp.category_name || (isBn ? 'সাধারণ খরচ' : 'Uncategorized')}</Text>
                  <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 15 }}>৳ {Number(exp.amount).toFixed(2)}</Text>
                </View>
                <View style={[styles.rowBetween, { marginTop: 4 }]}>
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{exp.spent_on}</Text>
                  <View style={{ backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600' }}>{exp.payment_method}</Text>
                  </View>
                </View>
                {!!exp.note && <Text variant="bodySmall" style={{ marginTop: 6, color: theme.colors.secondary }}>{exp.note}</Text>}
              </Card.Content>
            </Card>
          ))}
          {loadingMore && <ActivityIndicator style={{ marginVertical: 10 }} color={theme.colors.primary} />}
          {!loading && expenses.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="cash-check" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
              <Text style={{ marginTop: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                {isBn ? 'কোনো খরচের হিসাব পাওয়া যায়নি' : 'No expenses recorded'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB for Adding Expense */}
      <FAB
        visible={!showForm}
        icon="plus"
        color="#fff"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#4f46e5' }}
        onPress={() => {
          setForm(prev => ({ ...prev, spent_on: new Date().toISOString().slice(0, 10) }));
          setShowForm(true);
        }}
      />

      {/* Quick Add Expense Category Modal */}
      <Modal visible={showAddCatModal} transparent animationType="fade" onRequestClose={() => setShowAddCatModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowAddCatModal(false)}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 400 }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
                  {isBn ? 'নতুন খরচ ক্যাটাগরি তৈরি' : 'Add Expense Category'}
                </Text>
                <TextInput
                  label={isBn ? 'ক্যাটাগরির নাম *' : 'Category Name *'}
                  value={newCatName}
                  onChangeText={setNewCatName}
                  mode="outlined"
                  style={{ marginBottom: 16, backgroundColor: theme.colors.surface }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                  <Button onPress={() => setShowAddCatModal(false)}>{isBn ? 'বাতিল' : 'Cancel'}</Button>
                  <Button
                    mode="contained"
                    buttonColor="#4f46e5"
                    onPress={createCategory}
                    loading={creatingCat}
                    disabled={creatingCat || !newCatName.trim()}
                  >
                    {isBn ? 'সংরক্ষণ' : 'Save'}
                  </Button>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, elevation: 1 },
  expenseCard: { marginBottom: 10, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { marginBottom: 12 }
});
