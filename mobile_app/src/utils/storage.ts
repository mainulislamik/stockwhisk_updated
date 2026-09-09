import { Platform } from 'react-native';

// Cross-platform secure storage:
// - Native (Android/iOS): expo-secure-store (encrypted keystore)
// - Web (app.stockwhisk.com): localStorage fallback
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const WEB_PREFIX = 'sw_';

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(WEB_PREFIX + key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(WEB_PREFIX + key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(WEB_PREFIX + key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
