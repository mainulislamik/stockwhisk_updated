import * as SecureStore from 'expo-secure-store';
import { api } from '../api';

const OFFLINE_QUEUE_KEY = 'stockwhisk_offline_pos_queue_v1';

export interface OfflineSaleItem {
  product: number;
  quantity: number;
  unit_price: number | string;
}

export interface OfflineSalePayload {
  client_offline_id: string;
  items: OfflineSaleItem[];
  customer_name?: string;
  customer_phone?: string;
  paid: number | string;
  payment_method?: string;
  discount?: number | string;
  delivery_charge?: number | string;
  alteration_notes?: string;
  alteration_status?: string;
  created_at?: string;
  total?: number;
}

export async function getOfflineSalesQueue(): Promise<OfflineSalePayload[]> {
  try {
    const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Failed to read offline sales queue:', e);
    return [];
  }
}

export async function saveOfflineSale(sale: OfflineSalePayload): Promise<OfflineSalePayload[]> {
  try {
    const current = await getOfflineSalesQueue();
    const updated = [sale, ...current];
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save offline sale:', e);
    return [];
  }
}

export async function clearOfflineSalesQueue(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
  } catch (e) {
    console.error('Failed to clear offline sales queue:', e);
  }
}

export async function syncOfflineSalesQueue(): Promise<{ synced: any[]; failed: any[] }> {
  const queue = await getOfflineSalesQueue();
  if (queue.length === 0) {
    return { synced: [], failed: [] };
  }

  try {
    const res = await api.post('/pos/offline-sync/', { sales: queue });
    const { synced = [], failed = [] } = res.data || {};

    const syncedIds = new Set(synced.map((s: any) => s.client_offline_id));
    const remaining = queue.filter(q => !syncedIds.has(q.client_offline_id));

    if (remaining.length === 0) {
      await clearOfflineSalesQueue();
    } else {
      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }

    return { synced, failed };
  } catch (e) {
    console.error('Failed to sync offline sales queue:', e);
    throw e;
  }
}
