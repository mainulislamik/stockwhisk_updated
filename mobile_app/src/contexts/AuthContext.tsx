import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, setMemoryToken, setOnSessionExpired } from '../api';

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  shop_name: string;
  is_staff: boolean;
  role?: string;
  shop?: number;
  shop_code?: string;
};

export type BillingStatus = {
  plan: string | null;
  plan_name?: string | null;
  state?: "trial" | "paid" | "expired" | "none" | "free";
  on_trial: boolean;
  trial_ends_at: string | null;
  days_left?: number;
  ends_at?: string | null;
};

type AuthContextType = {
  user: User | null;
  billing: BillingStatus | null;
  loading: boolean;
  login: (access: string, refresh: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setBilling(null);
    });
    loadUser();
    return () => {
      setOnSessionExpired(null);
    };
  }, []);

  const loadUser = async () => {
    try {
      let token;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('access_token');
      } else {
        token = await SecureStore.getItemAsync('access_token');
      }

      if (token) {
        setMemoryToken(token);
        try {
          const [userRes, billingRes] = await Promise.allSettled([
            api.get('/auth/me/'),
            api.get('/billing/status/')
          ]);

          if (userRes.status === 'fulfilled') {
            setUser(userRes.value.data);
          } else {
            throw userRes.reason;
          }

          if (billingRes.status === 'fulfilled') {
            setBilling(billingRes.value.data);
          } else {
            console.log('Billing load error', billingRes.reason);
          }
        } catch (e) {
          console.log('User load error', e);
        }
      }
    } catch (e) {
      console.log('User load error', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (access: string, refresh: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
    } else {
      await SecureStore.setItemAsync('access_token', access);
      await SecureStore.setItemAsync('refresh_token', refresh);
    }
    setMemoryToken(access);
    await loadUser();
  };

  const logout = async () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } else {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
    }
    setMemoryToken(null);
    setUser(null);
    setBilling(null);
  };

  return (
    <AuthContext.Provider value={{ user, billing, loading, login, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
