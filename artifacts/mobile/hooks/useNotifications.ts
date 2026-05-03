import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateUserFcmToken } from "@/lib/firebase-data";
import { logger } from "@/lib/logger";

const NOTIFS_KEY = "@taryaq_notifications";

export interface TaryaqNotification {
  id: string;
  type: "tip" | "appointment" | "offer" | "system" | "doctor";
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: string;
}

const INITIAL_NOTIFICATIONS: TaryaqNotification[] = [
  {
    id: "n1",
    type: "system",
    title: "مرحباً في ترياق!",
    body: "منصتك الصحية الأولى في العراق. ابحث عن أطباء وصيدليات قريبة منك.",
    time: "الآن",
    read: false,
    icon: "heart",
  },
  {
    id: "n2",
    type: "doctor",
    title: "أطباء متاحون قريباً منك",
    body: "د. أحمد محمد علي — طب عام متاح للحجز اليوم في الكرادة.",
    time: "منذ ساعة",
    read: false,
    icon: "user",
  },
  {
    id: "n3",
    type: "offer",
    title: "عرض خاص من صيدلية الشفاء",
    body: "خصم 20% على الفيتامينات ومكملات المناعة لفترة محدودة.",
    time: "منذ 3 ساعات",
    read: false,
    icon: "tag",
  },
  {
    id: "n4",
    type: "tip",
    title: "نصيحة صحية اليوم",
    body: "شرب 8 أكواب من الماء يومياً يحسّن وظائف الكلى ويطرد السموم من جسمك.",
    time: "أمس",
    read: true,
    icon: "droplet",
  },
  {
    id: "n5",
    type: "appointment",
    title: "تذكير بالموعد",
    body: "موعدك مع د. سارة حسين غداً الساعة 10 صباحاً. لا تنسَ الحضور مبكراً.",
    time: "أمس",
    read: true,
    icon: "calendar",
  },
];

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerPushTokenForUser(phone: string): Promise<string | null> {
  if (Platform.OS === "web" || !phone) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;
    if (!token) return null;
    await updateUserFcmToken(phone, token);
    return token;
  } catch (e) {
    logger.error("[Notifications] Failed to register push token:", e);
    return null;
  }
}

export async function getStoredNotifications(): Promise<TaryaqNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFS_KEY);
    if (raw) return JSON.parse(raw) as TaryaqNotification[];
    await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
    return INITIAL_NOTIFICATIONS;
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export async function markAllRead(): Promise<void> {
  const notifs = await getStoredNotifications();
  const updated = notifs.map((n) => ({ ...n, read: true }));
  await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
}

export async function markNotifRead(id: string): Promise<void> {
  const notifs = await getStoredNotifications();
  const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
  await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
}

export async function clearAllNotifications(): Promise<void> {
  await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify([]));
}

export async function getUnreadCount(): Promise<number> {
  const notifs = await getStoredNotifications();
  return notifs.filter((n) => !n.read).length;
}

export function useNotificationSetup() {
  const notifListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === "web") return;
    notifListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      const newNotif: TaryaqNotification = {
        id: Date.now().toString(),
        type: "system",
        title: notification.request.content.title || "إشعار جديد",
        body: notification.request.content.body || "",
        time: "الآن",
        read: false,
        icon: "bell",
      };
      const existing = await getStoredNotifications();
      await AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify([newNotif, ...existing]));
    });

    return () => {
      if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
