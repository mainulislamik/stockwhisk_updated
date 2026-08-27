import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, Dimensions, FlatList } from 'react-native';
import { Appbar, Text, Card, useTheme, Surface, Chip, ActivityIndicator, Searchbar, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import PageGuideButton from '../components/PageGuideButton';

type WarrantyGroup = {
  product_id: number;
  product_name: string;
  sku: string;
  warranty_months: number;
  count: number;
};

type Warranty = {
  id: number;
  product_name: string;
  customer_name: string | null;
  serial_no: string;
  period_months: number;
  start_date: string;
  expiry_date: string;
  status: string;
};

const STATUS_FILTERS = [
  { value: '', label: 'All', icon: 'filter-variant' },
  { value: 'active', label: 'Active', icon: 'check-circle' },
  { value: 'expiring_soon', label: 'Expiring Soon', icon: 'clock-alert' },
  { value: 'expired', label: 'Expired', icon: 'close-circle' },
  { value: 'claimed', label: 'Claimed', icon: 'shield-alert' }
];

export default function WarrantiesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [groups, setGroups] = useState<WarrantyGroup[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  
  const fetchGroups = async () => {
    try {
      const res = await api.get('/catalog/product-units/warranty-groups/');
      setGroups(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWarranties = async () => {
    try {
      const res = await api.get('/service/warranties/', {
        params: {
          search: searchQuery,
          status: statusFilter || undefined,
          page_size: 50
        }
      });
      setWarranties(res.data.results || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'products') {
      await fetchGroups();
    } else {
      await fetchWarranties();
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'products') {
      await fetchGroups();
    } else {
      await fetchWarranties();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter]);

  // Debounced search for warranties
  useEffect(() => {
    if (activeTab === 'issued') {
      const timeout = setTimeout(() => {
        fetchData();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const filteredGroups = groups.filter(g => 
    !searchQuery || 
    (g.product_name + g.sku).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStatusBadge = (status: string) => {
    let color = theme.colors.outline;
    let bgColor = theme.colors.surfaceVariant;
    let text = status.replace('_', ' ').toUpperCase();

    switch(status) {
      case 'active': color = '#10b981'; bgColor = '#d1fae5'; break;
      case 'expiring_soon': color = '#f59e0b'; bgColor = '#fef3c7'; break;
      case 'expired': color = '#6b7280'; bgColor = '#f3f4f6'; break;
      case 'claimed': color = '#3b82f6'; bgColor = '#dbeafe'; break;
      case 'void': color = '#111827'; bgColor = '#e5e7eb'; break;
    }

    if (isDarkMode) {
      switch(status) {
        case 'active': color = '#34d399'; bgColor = '#064e3b'; break;
        case 'expiring_soon': color = '#fbbf24'; bgColor = '#78350f'; break;
        case 'expired': color = '#9ca3af'; bgColor = '#374151'; break;
        case 'claimed': color = '#60a5fa'; bgColor = '#1e3a8a'; break;
        case 'void': color = '#d1d5db'; bgColor = '#1f2937'; break;
      }
    }

    return (
      <View style={{ backgroundColor: bgColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: color }}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'ওয়ারেন্টি ভেরিফিকেশন' : 'Warranty Check'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/service/warranties" />
      </Appbar.Header>

      <View style={{ padding: 12, backgroundColor: theme.colors.surface }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'products', label: isBN ? 'ওয়ারেন্টি পণ্য' : 'Products' },
            { value: 'issued', label: isBN ? 'ইস্যুকৃত রেকর্ড' : 'Issued Records' },
          ]}
          style={{ marginBottom: 12 }}
        />
        
        <Searchbar
          placeholder={activeTab === 'products' ? (isBN ? 'পণ্য খুঁজুন...' : 'Search products...') : (isBN ? 'সিরিয়াল/কাস্টমার খুঁজুন...' : 'Search serial/customer...')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ elevation: 0, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.outline }}
          iconColor={theme.colors.primary}
        />

        {activeTab === 'issued' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {STATUS_FILTERS.map(f => (
              <Chip 
                key={f.value} 
                selected={statusFilter === f.value} 
                onPress={() => setStatusFilter(f.value)}
                style={{ marginRight: 8, backgroundColor: statusFilter === f.value ? theme.colors.primaryContainer : theme.colors.background }}
                textStyle={{ color: statusFilter === f.value ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}
                icon={f.icon}
              >
                {f.label}
              </Chip>
            ))}
          </ScrollView>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : activeTab === 'products' ? (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => `${item.product_id}-${item.warranty_months}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <MaterialCommunityIcons name="shield-outline" size={48} color={theme.colors.outline} />
              <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>{isBN ? 'কোনো ওয়ারেন্টি পণ্য পাওয়া যায়নি' : 'No warranted products found'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.product_name}</Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginTop: 2 }}>{item.sku || 'N/A'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Surface style={{ backgroundColor: theme.colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 6 }}>
                    <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold', fontSize: 12 }}>{item.warranty_months} {isBN ? 'মাস' : 'Months'}</Text>
                  </Surface>
                  <Text style={{ color: theme.colors.outline, fontSize: 12 }}>{item.count} {isBN ? 'পিস স্টক' : 'In Stock'}</Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={warranties}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <MaterialCommunityIcons name="text-box-search-outline" size={48} color={theme.colors.outline} />
              <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>{isBN ? 'কোনো ওয়ারেন্টি রেকর্ড পাওয়া যায়নি' : 'No warranty records found'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10, backgroundColor: theme.colors.surface }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>{item.product_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <MaterialCommunityIcons name="barcode-scan" size={14} color={theme.colors.outline} style={{ marginRight: 4 }} />
                      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' }}>{item.serial_no}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account" size={14} color={theme.colors.outline} style={{ marginRight: 4 }} />
                      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>{item.customer_name || (isBN ? 'অজানা' : 'Unknown')}</Text>
                    </View>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.surfaceVariant }}>
                  <View>
                    <Text style={{ fontSize: 11, color: theme.colors.outline }}>{isBN ? 'শুরুর তারিখ' : 'Start Date'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '500' }}>{new Date(item.start_date).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.outline }}>{isBN ? 'মেয়াদ শেষ' : 'Expiry Date'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: item.status === 'expired' ? theme.colors.error : theme.colors.onSurface }}>{new Date(item.expiry_date).toLocaleDateString()}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </View>
  );
}
