import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Text, Appbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePreferences } from '../contexts/PreferencesContext';
import { api } from '../api';

const HEADER_HEIGHT = 64;

export default function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { language } = usePreferences();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (p: number) => {
    try {
      if (p === 1) setLoading(true); else setLoadingMore(true);
      const res = await api.get(`/notifications/notifications/?page=${p}&page_size=15`);
      const results = res.data.results || [];
      if (p === 1) setNotifications(results);
      else setNotifications(prev => [...prev, ...results]);
      setHasMore(!!res.data.next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchPage(1); }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchPage(next);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/notifications/read_all/');
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    } catch {
      Alert.alert('Error', 'Could not mark all as read');
    }
  };

  const markAsRead = async (id: number) => {
    await api.post(`/notifications/notifications/${id}/read/`).catch(() => {});
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={language === 'BN' ? 'নোটিফিকেশন' : 'Notifications'} titleStyle={{ fontWeight: 'bold' }} />
        <Appbar.Action icon="check-all" onPress={markAllAsRead} color={theme.colors.primary} />
      </Appbar.Header>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          scrollEventThrottle={400}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            if (nearBottom) loadMore();
          }}
        >
          {notifications.map((notif) => (
            <TouchableOpacity 
              key={notif.id}
              onPress={() => { if (!notif.is_read) markAsRead(notif.id); }}
              style={[
                styles.notificationCard, 
                { 
                  backgroundColor: theme.colors.surface, 
                  borderLeftColor: notif.is_read ? 'transparent' : '#ef4444',
                  borderLeftWidth: notif.is_read ? 0 : 4
                }
              ]}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name={
                    notif.type === 'low_stock' ? 'package-variant-closed' 
                    : notif.type === 'out_of_stock' ? 'package-variant-closed'
                    : notif.type === 'subscription' ? 'star-circle' 
                    : 'bell'
                  } 
                  size={24} 
                  color={notif.is_read ? theme.colors.secondary : '#ef4444'} 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>{notif.title}</Text>
                <Text style={[styles.body, { color: theme.colors.secondary }]}>{notif.message}</Text>
                <Text style={[styles.time, { color: theme.colors.primary }]}>{new Date(notif.created_at).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {loadingMore && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
          )}

          {!hasMore && notifications.length > 0 && (
            <Text style={{ textAlign: 'center', color: theme.colors.secondary, padding: 16, fontSize: 12 }}>
              {language === 'BN' ? 'সব নোটিফিকেশন দেখানো হয়েছে' : 'All notifications loaded'}
            </Text>
          )}

          {notifications.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell-sleep" size={48} color={theme.colors.secondary} />
              <Text style={{ marginTop: 16, color: theme.colors.secondary }}>
                {language === 'BN' ? 'কোনো নোটিফিকেশন নেই' : 'No notifications'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  }
});
