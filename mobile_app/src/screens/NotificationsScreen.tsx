import { triggerLocalSystemNotification, setupSystemNotifications } from '../services/notificationService';
import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Text, Appbar, useTheme, SegmentedButtons } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { usePreferences } from "../contexts/PreferencesContext";
import { api } from "../api";

export default function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { language } = usePreferences();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const isBn = language === "BN";

  const sendTestNotification = async () => {
    try {
      await setupSystemNotifications();
      await triggerLocalSystemNotification(
        isBn ? "🔔 টেস্ট নোটিফিকেশন" : "🔔 Test Notification",
        isBn ? "আপনার অ্যান্ড্রয়েড ফোনে নোটিফিকেশন পপআপ সফলভাবে কাজ করছে!" : "System notifications are working properly on your device!",
        { test: true }
      );
      Alert.alert(
        isBn ? "নোটিফিকেশন পাঠানো হয়েছে" : "Notification Triggered",
        isBn ? "আপনার স্ট্যাটাস বার এবং লক স্ক্রিন চেক করুন!" : "Check your Android status bar and lock screen!"
      );
    } catch (e) {
      Alert.alert("Error", "Could not trigger test notification.");
    }
  };


  const fetchPage = async (p: number, currentFilter = filter) => {
    try {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);

      let url = `/notifications/notifications/?page=${p}&page_size=15`;
      if (currentFilter === "unread") {
        url += "&unread=true";
      }

      const res = await api.get(url);
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

  useEffect(() => {
    setPage(1);
    fetchPage(1, filter);
  }, [filter]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchPage(next, filter);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/notifications/read_all/");
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
      if (filter === "unread") {
        setNotifications([]);
      }
    } catch {
      Alert.alert("ত্রুটি", isBn ? "পড়া হিসাবে চিহ্ণিত করা যায়নি" : "Could not mark all as read");
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/notifications/${id}/read/`);
      setNotifications(n => {
        if (filter === "unread") {
          return n.filter(x => x.id !== id);
        }
        return n.map(x => (x.id === id ? { ...x, is_read: true } : x));
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/notifications/notifications/${id}/`);
      setNotifications(n => n.filter(x => x.id !== id));
    } catch {
      Alert.alert("ত্রুটি", isBn ? "মুছে ফেলা সম্ভব হয়নি" : "Could not delete notification");
    }
  };

  const clearRead = async () => {
    Alert.alert(
      isBn ? "পড়া নোটিফিকেশন মুছুন" : "Clear Read Notifications",
      isBn ? "সকল পড়া শেষ হওয়া নোটিফিকেশন কি মুছে ফেলতে চান?" : "Are you sure you want to clear all read notifications?",
      [
        { text: isBn ? "না" : "Cancel", style: "cancel" },
        {
          text: isBn ? "হ্যাঁ, মুছুন" : "Clear Read",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/notifications/notifications/clear_read/");
              setNotifications(n => n.filter(x => !x.is_read));
            } catch {
              Alert.alert("ত্রুটি", isBn ? "ক্লিয়ার করা যায়নি" : "Could not clear read notifications");
            }
          }
        }
      ]
    );
  };

  const clearAll = async () => {
    Alert.alert(
      isBn ? "সব নোটিফিকেশন মুছুন" : "Clear All Notifications",
      isBn ? "সব নোটিফিকেশন চিরতরে মুছে ফেলতে চান?" : "Are you sure you want to delete ALL notifications?",
      [
        { text: isBn ? "না" : "Cancel", style: "cancel" },
        {
          text: isBn ? "সব মুছুন" : "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/notifications/notifications/clear_all/");
              setNotifications([]);
            } catch {
              Alert.alert("ত্রুটি", isBn ? "ক্লিয়ার করা যায়নি" : "Could not clear all notifications");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBn ? "নোটিফিকেশন" : "Notifications"} titleStyle={{ fontWeight: "bold" }} />
        <Appbar.Action icon="bell-ring-outline" onPress={sendTestNotification} color="#10b981" />
        <Appbar.Action icon="check-all" onPress={markAllAsRead} color={theme.colors.primary} />
        <Appbar.Action icon="broom" onPress={clearRead} color="#eab308" />
        <Appbar.Action icon="delete-outline" onPress={clearAll} color="#ef4444" />
      </Appbar.Header>

      <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.surface }}>
        <SegmentedButtons
          value={filter}
          onValueChange={val => setFilter(val as "all" | "unread")}
          buttons={[
            { value: "all", label: isBn ? "সব (All)" : "All" },
            { value: "unread", label: isBn ? "পড়া হয়নি (Unread)" : "Unread" }
          ]}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
          {notifications.map(notif => (
            <TouchableOpacity
              key={notif.id}
              onPress={() => {
                if (!notif.is_read) markAsRead(notif.id);
              }}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderLeftColor: notif.is_read ? "transparent" : "#ef4444",
                  borderLeftWidth: notif.is_read ? 0 : 4
                }
              ]}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={
                    notif.type === "low_stock" || notif.type === "out_of_stock"
                      ? "package-variant-closed"
                      : notif.type === "subscription"
                      ? "star-circle"
                      : "bell"
                  }
                  size={24}
                  color={notif.is_read ? theme.colors.secondary : "#ef4444"}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>{notif.title}</Text>
                <Text style={[styles.body, { color: theme.colors.secondary }]}>{notif.message}</Text>
                <Text style={[styles.time, { color: theme.colors.primary }]}>{new Date(notif.created_at).toLocaleString()}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteNotification(notif.id)}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.secondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {loadingMore && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />}

          {!hasMore && notifications.length > 0 && (
            <Text style={{ textAlign: "center", color: theme.colors.secondary, padding: 16, fontSize: 12 }}>
              {isBn ? "সব নোটিফিকেশন দেখানো হয়েছে" : "All notifications loaded"}
            </Text>
          )}

          {notifications.length === 0 && (
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="bell-sleep" size={48} color={theme.colors.secondary} />
              <Text style={{ marginTop: 16, color: theme.colors.secondary }}>
                {isBn ? "কোনো নোটিফিকেশন নেই" : "No notifications"}
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
    flexDirection: "row",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    alignItems: "center"
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: "center"
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4
  },
  body: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18
  },
  time: {
    fontSize: 11,
    fontWeight: "500"
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 4
  }
});
