import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://stockwhisk.com/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  }
});

let memoryToken: string | null = null;
export const setMemoryToken = (t: string | null) => { memoryToken = t; };

// Interceptor to add auth token
api.interceptors.request.use(async (config) => {
  try {
    let token = memoryToken;
    if (!token) {
      if (Platform.OS === 'web') {
        token = localStorage.getItem('access_token');
      } else {
        token = await SecureStore.getItemAsync('access_token');
      }
      memoryToken = token;
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // secure store error
  }
  return config;
});
