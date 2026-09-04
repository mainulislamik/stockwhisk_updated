import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';

import DashboardScreen from '../screens/DashboardScreen';
import POSScreen from '../screens/POSScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ReportsScreen from '../screens/ReportsScreen';

function MoreMenuScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const { user } = useAuth();
  const isBn = language === 'BN';

  const isServiceEnabled = user?.shop_service_enabled !== false;
  const isFinanceEnabled = user?.shop_finance_enabled !== false;

  const accountsItems: any[] = [];
  if (isFinanceEnabled) {
    accountsItems.push(
      { name: 'AccountingScreen', icon: 'calculator-variant', color: '#1e3a8a', bg: '#eff6ff', labelEn: 'Accounting & P&L', labelBn: 'একাউন্টিং ও লাভ' },
      { name: 'SettlementScreen', icon: 'cash-register', color: '#16a34a', bg: '#f0fdf4', labelEn: 'Daily Settlement', labelBn: 'দৈনিক ক্যাশ ক্লোজিং' },
      { name: 'ExpensesScreen', icon: 'cash-remove', color: '#be185d', bg: '#fdf2f8', labelEn: 'Expenses', labelBn: 'দোকানের খরচ' }
    );
  }
  if (isServiceEnabled) {
    accountsItems.push(
      { name: 'ServiceTickets', icon: 'tools', color: '#9333ea', bg: '#faf5ff', labelEn: 'Service & Repair', labelBn: 'সার্ভিস ও মেরামত' },
      { name: 'WarrantiesScreen', icon: 'shield-check', color: '#0ea5e9', bg: '#e0f2fe', labelEn: 'Warranties', labelBn: 'ওয়ারেন্টি চেক' }
    );
  }

  const sections = [
    {
      titleEn: 'Sales & Billing',
      titleBn: 'বিক্রয় ও কাস্টমার লেনদেন',
      items: [
        { name: 'SalesScreen', icon: 'receipt', color: '#2563eb', bg: '#eff6ff', labelEn: 'Sales History', labelBn: 'বিক্রয় ইতিহাস' },
        { name: 'DuesScreen', icon: 'cash-multiple', color: '#dc2626', bg: '#fef2f2', labelEn: 'Customer Dues', labelBn: 'বকেয়া খাতা' },
        { name: 'EMIScreen', icon: 'calendar-check', color: '#0284c7', bg: '#f0f9ff', labelEn: 'EMI Installments', labelBn: 'ইএমআই ও কিস্তি' },
        { name: 'ReturnsScreen', icon: 'keyboard-return', color: '#ea580c', bg: '#fff7ed', labelEn: 'Returns & Replace', labelBn: 'পণ্য ফেরত ও বদল' },
      ],
    },
    {
      titleEn: 'Stock & Purchasing',
      titleBn: 'স্টক ও সরবরাহকারী',
      items: [
        { name: 'ProductsScreen', icon: 'package-variant', color: '#7c3aed', bg: '#f5f3ff', labelEn: 'Products & Inward', labelBn: 'পণ্য ও ইনওয়ার্ড' },
        { name: 'LookupScreen', icon: 'line-scan', color: '#f59e0b', bg: '#fef3c7', labelEn: 'Item Lookup', labelBn: 'আইটেম লুকআপ' },
        { name: 'PurchasesScreen', icon: 'shopping', color: '#0891b2', bg: '#ecfeff', labelEn: 'Purchase History', labelBn: 'ক্রয় ইতিহাস' },
        { name: 'SuppliersScreen', icon: 'truck-delivery', color: '#d97706', bg: '#fffbeb', labelEn: 'Suppliers / Vendors', labelBn: 'সরবরাহকারী' },
        { name: 'ManufacturingScreen', icon: 'factory', color: '#f59e0b', bg: '#fffbeb', labelEn: 'Manufacturing Hub', labelBn: 'প্রোডাকশন হাব' },
        { name: 'BarcodesScreen', icon: 'barcode-scan', color: '#0284c7', bg: '#f0f9ff', labelEn: 'Barcode Generator', labelBn: 'বারকোড জেনারেটর' },
      ],
    },
    ...(accountsItems.length > 0 ? [{
      titleEn: 'Accounts & Shop Operations',
      titleBn: 'হিসাব ও দোকান পরিচালনা',
      items: accountsItems,
    }] : []),
    {
      titleEn: 'Directory & Preferences',
      titleBn: 'ডিরেক্টরি ও সেটিংস',
      items: [
        { name: 'CustomersScreen', icon: 'account-group', color: '#059669', bg: '#ecfdf5', labelEn: 'Customers', labelBn: 'গ্রাহক তালিকা' },
        { name: 'UsersAndRoles', icon: 'shield-account', color: '#4f46e5', bg: '#eef2ff', labelEn: 'Users & Roles', labelBn: 'ইউজার ও রোল' },
        { name: 'SettingsScreen', icon: 'cog-outline', color: '#64748b', bg: '#f8fafc', labelEn: 'Shop Settings', labelBn: 'দোকানের সেটিংস' },
        { name: 'TutorialsScreen', icon: 'play-circle-outline', color: '#e11d48', bg: '#fff1f2', labelEn: 'Video Tutorials', labelBn: 'টিউটোরিয়াল' },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 16, color: theme.colors.onSurface }}>
          ⚡ {isBn ? 'সব মডিউল ও ফিচার' : 'All Modules & Apps'}
        </Text>

        {sections.map((sec, sIdx) => (
          <View key={sIdx} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, letterSpacing: 0.2 }}>
              {isBn ? sec.titleBn : sec.titleEn}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
              {sec.items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    minWidth: 145,
                    backgroundColor: theme.colors.surface,
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                    elevation: 1,
                  }}
                  onPress={() => (navigation as any).navigate(item.name)}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? item.color + '25' : item.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                    }}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 12, color: theme.colors.onSurface }}>
                      {isBn ? item.labelBn : item.labelEn}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const theme = useTheme();
  const { language, isDarkMode } = usePreferences();
  const { user } = useAuth();
  const isBn = language === 'BN';
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 8);
  const tabHeight = 60 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? '#818cf8' : '#4f46e5',
        tabBarInactiveTintColor: isDarkMode ? '#64748b' : '#94a3b8',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: isBn ? 'হোম' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' }] : null}>
              <MaterialCommunityIcons name={focused ? 'view-dashboard' : 'view-dashboard-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="POS"
        component={POSScreen}
        options={{
          tabBarLabel: isBn ? 'বিক্রয়' : 'POS',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' }] : null}>
              <MaterialCommunityIcons name={focused ? 'cash-register' : 'cart-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarLabel: isBn ? 'ইনভেন্টরি' : 'Inventory',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' }] : null}>
              <MaterialCommunityIcons name={focused ? 'package-variant-closed' : 'package-variant'} color={color} size={22} />
            </View>
          ),
        }}
      />
      {user?.shop_reports_enabled !== false && (
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            tabBarLabel: isBn ? 'রিপোর্ট' : 'Reports',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconWrap, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' }] : null}>
                <MaterialCommunityIcons name={focused ? 'chart-box' : 'chart-box-outline'} color={color} size={22} />
              </View>
            ),
          }}
        />
      )}
      <Tab.Screen
        name="More"
        component={MoreMenuScreen}
        options={{
          tabBarLabel: isBn ? 'মেনু' : 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' }] : null}>
              <MaterialCommunityIcons name={focused ? 'dots-grid' : 'menu'} color={color} size={22} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 14,
  },
});
