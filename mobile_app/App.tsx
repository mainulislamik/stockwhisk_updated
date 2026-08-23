import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PreferencesProvider, usePreferences } from './src/contexts/PreferencesContext';
import LoginScreen from './src/screens/LoginScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import TabNavigator from './src/navigation/TabNavigator';
import SalesScreen from './src/screens/SalesScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import DuesScreen from './src/screens/DuesScreen';
import SuppliersScreen from './src/screens/SuppliersScreen';
import PurchasesScreen from './src/screens/PurchasesScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UsersAndRolesScreen from './src/screens/UsersAndRolesScreen';
import TutorialsScreen from './src/screens/TutorialsScreen';
import ServiceTicketsScreen from './src/screens/ServiceTicketsScreen';
import EMIScreen from './src/screens/EMIScreen';
import ReturnsScreen from './src/screens/ReturnsScreen';
import SettlementScreen from './src/screens/SettlementScreen';
import AccountingScreen from './src/screens/AccountingScreen';
import BarcodesScreen from './src/screens/BarcodesScreen';
import GlobalHeader from './src/components/GlobalHeader';
import { View, LogBox, Platform } from 'react-native';

LogBox.ignoreLogs([
  'Invalid DOM property',
  'Unknown event handler property',
  'TouchableMixin is deprecated',
  'props.pointerEvents is deprecated',
  'Animated: `useNativeDriver` is not supported'
]);
const Stack = createStackNavigator();

const customLightTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#4f46e5',
    primaryContainer: '#eef2ff',
    secondary: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    error: '#ef4444',
  },
};

const customDarkTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#6366f1',
    primaryContainer: '#1e1b4b',
    secondary: '#94a3b8',
    background: '#090d16',
    surface: '#0f172a',
    surfaceVariant: '#1e293b',
    error: '#ef4444',
  },
};

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      {user && <GlobalHeader />}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="SalesScreen" component={SalesScreen} />
            <Stack.Screen name="ProductsScreen" component={ProductsScreen} />
            <Stack.Screen name="CustomersScreen" component={CustomersScreen} />
            <Stack.Screen name="DuesScreen" component={DuesScreen} />
            <Stack.Screen name="SuppliersScreen" component={SuppliersScreen} />
            <Stack.Screen name="PurchasesScreen" component={PurchasesScreen} />
            <Stack.Screen name="ExpensesScreen" component={ExpensesScreen} />
            <Stack.Screen name="ServiceTickets" component={ServiceTicketsScreen} />
            <Stack.Screen name="EMIScreen" component={EMIScreen} />
            <Stack.Screen name="ReturnsScreen" component={ReturnsScreen} />
            <Stack.Screen name="SettlementScreen" component={SettlementScreen} />
            <Stack.Screen name="AccountingScreen" component={AccountingScreen} />
            <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
            <Stack.Screen name="UsersAndRoles" component={UsersAndRolesScreen} />
            <Stack.Screen name="TutorialsScreen" component={TutorialsScreen} />
            <Stack.Screen name="BarcodesScreen" component={BarcodesScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </View>
  );
}

function ThemedApp() {
  const { isDarkMode } = usePreferences();
  const theme = isDarkMode ? customDarkTheme : customLightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#030712' : '#e2e8f0', alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: 500,
              backgroundColor: theme.colors.background,
              overflow: 'hidden',
              borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
              borderRightWidth: Platform.OS === 'web' ? 1 : 0,
              borderColor: isDarkMode ? '#1e293b' : '#cbd5e1',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <NavigationContainer>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </NavigationContainer>
          </View>
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <ThemedApp />
    </PreferencesProvider>
  );
}
