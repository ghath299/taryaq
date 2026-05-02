import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import {
  getStoredNotifications,
  markAllRead,
  markNotifRead,
  type TaryaqNotification,
} from "@/hooks/useNotifications";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const iconColorMap: Record<TaryaqNotification["type"], string> = {
  tip: "#4CD964",
  appointment: "#5EDFFF",
  offer: "#FFCC00",
  system: "#1F6AE1",
  doctor: "#5EDFFF",
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<TaryaqNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifs = useCallback(async () => {
    const data = await getStoredNotifications();
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((n) => n.map((item) => ({ ...item, read: true })));
  };

  const handleItemPress = async (id: string) => {
    await markNotifRead(id);
    setNotifications((n) => n.map((item) => item.id === id ? { ...item, read: true } : item));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item, index }: { item: TaryaqNotification; index: number }) => {
    const color = iconColorMap[item.type] || theme.primary;

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
        <Pressable
          onPress={() => handleItemPress(item.id)}
          style={[
            styles.notifCard,
            {
              backgroundColor: item.read ? (theme.card || theme.backgroundDefault) : addAlpha(theme.primary, 0.06),
              borderColor: item.read ? "transparent" : addAlpha(theme.primary, 0.2),
              borderWidth: item.read ? 0 : 1,
            },
          ]}
        >
          <View style={[styles.notifIcon, { backgroundColor: addAlpha(color, 0.15) }]}>
            <Feather name={item.icon as any || "bell"} size={20} color={color} />
          </View>
          <View style={styles.notifBody}>
            <View style={styles.notifHeader}>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
              <ThemedText type="small" style={[styles.notifTime, { color: theme.textSecondary }]}>{item.time}</ThemedText>
              <ThemedText type="h4" style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</ThemedText>
            </View>
            <ThemedText type="small" style={[styles.notifDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.body}</ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {unreadCount > 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.topBar, { backgroundColor: addAlpha(theme.primary, 0.08), borderBottomColor: theme.border }]}>
          <Pressable onPress={handleMarkAllRead}>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>تعليم الكل كمقروء</ThemedText>
          </Pressable>
          <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
            <ThemedText type="caption" style={{ color: isDark(theme) ? "#000" : "#FFF", fontWeight: "700" }}>{unreadCount}</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{unreadCount} غير مقروءة</ThemedText>
        </Animated.View>
      ) : null}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!notifications.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifs(); }} tintColor={theme.primary} />}
        ListEmptyComponent={loading ? null : <EmptyState icon="bell" title="لا توجد إشعارات" description="ستظهر إشعاراتك هنا" />}
      />
    </View>
  );
}

function isDark(theme: any) { return theme.backgroundRoot === "#0D1117"; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  unreadBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
  notifCard: { flexDirection: "row-reverse" as const, alignItems: "flex-start", padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.md },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifBody: { flex: 1 },
  notifHeader: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 4, gap: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifTitle: { fontWeight: "700", flex: 1, textAlign: "right" },
  notifTime: { flexShrink: 0 },
  notifDesc: { textAlign: "right", lineHeight: 20 },
});
