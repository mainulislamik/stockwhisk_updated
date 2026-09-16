import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let isConfigured = false;
let notifiedIds = new Set<number>();

export async function setupSystemNotifications() {
  if (isConfigured || Platform.OS === "web") return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "StockWhisk Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4f46e5",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }
    isConfigured = true;
  } catch (e) {
    console.warn("Failed to setup system notifications:", e);
  }
}

export async function triggerLocalSystemNotification(title: string, body: string, data: any = {}) {
  if (Platform.OS === "web") return;
  try {
    await setupSystemNotifications();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || "StockWhisk Notification",
        body: body || "You have new updates in your shop.",
        data,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Failed to trigger local system notification:", e);
  }
}

export function checkAndNotifyNewItems(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return;
  const unreadItems = items.filter((item: any) => !item.is_read);
  if (unreadItems.length === 0) return;

  for (const item of unreadItems) {
    if (item.id && !notifiedIds.has(item.id)) {
      notifiedIds.add(item.id);
      triggerLocalSystemNotification(
        item.title || "StockWhisk Alert",
        item.message || item.body || "New notification received.",
        { notificationId: item.id }
      );
    }
  }
}
