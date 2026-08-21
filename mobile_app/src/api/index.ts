import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://stockwhisk.com/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let memoryToken: string | null = null;
let memoryRefreshToken: string | null = null;

export const setMemoryToken = (t: string | null) => {
  memoryToken = t;
};

export const setMemoryRefreshToken = (t: string | null) => {
  memoryRefreshToken = t;
};

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

// Response interceptor to auto-refresh expired JWT token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        let refreshToken = memoryRefreshToken;
        if (!refreshToken) {
          if (Platform.OS === 'web') {
            refreshToken = localStorage.getItem('refresh_token');
          } else {
            refreshToken = await SecureStore.getItemAsync('refresh_token');
          }
          memoryRefreshToken = refreshToken;
        }

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const refreshRes = await axios.post(`${API_BASE}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = refreshRes.data.access;
        if (newAccess) {
          if (Platform.OS === 'web') {
            localStorage.setItem('access_token', newAccess);
          } else {
            await SecureStore.setItemAsync('access_token', newAccess);
          }
          setMemoryToken(newAccess);
          api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          processQueue(null, newAccess);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Clear expired tokens
        if (Platform.OS === 'web') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        } else {
          try {
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
          } catch (e) {}
        }
        setMemoryToken(null);
        setMemoryRefreshToken(null);
      } finally {
        isRefreshing = false;
      }
    }

    // Transient network retry for GET requests (max 1 retry on connection drop or 502/503/504)
    if (
      (!error.response || [502, 503, 504].includes(error.response?.status)) &&
      originalRequest &&
      (originalRequest.method?.toLowerCase() === 'get' || !originalRequest.method) &&
      !originalRequest._networkRetried
    ) {
      originalRequest._networkRetried = true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);
