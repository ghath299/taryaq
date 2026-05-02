import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToUserBookings, type FirebaseBooking } from "@/lib/firebase-data";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

type Booking = FirebaseBooking & { id: string; clinicId: string };

const statusColors: Record<string, string> = {
  انتظار: "#FFCC00",
  مقبول: "#4CD964",
  مرفوض: "#FF6B6B",
  مكتمل: "#5EDFFF",
  "لم يحضر": "#ADB5BD",
};

const statusIcons: Record<string, keyof typeof import("@expo/vector-icons").Feather.glyphMap> = {
  انتظار: "clock",
  مقبول: "check-circle",
  مرفوض: "x-circle",
  مكتمل: "check-circle",
  "لم يحضر": "slash",
};

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id && !user?.phoneNumber) { setLoading(false); return; }
    const ownerId = user.id || user.phoneNumber;
    const unsubscribe = subscribeToUserBookings(ownerId!, (data) => {
      const sorted = [...data].sort((a, b) => {
        const tA = typeof a.createdAt === "number" ? a.createdAt : 0;
        const tB = typeof b.createdAt === "number" ? b.createdAt : 0;
        return tB - tA;
      });
      setBookings(sorted);
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  }, [user?.id, user?.phoneNumber]);

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const renderBooking = ({ item, index }: { item: Booking; index: number }) => {
    const statusColor = statusColors[item.status] || theme.textSecondary;
    const statusIcon = statusIcons[item.status] || "circle";

    return (
      <Animated.View entering={FadeInUp.delay(index * 60).duration(300)}>
        <Pressable android_ripple={{ color: "transparent" }} style={[styles.card, { backgroundColor: theme.card || theme.backgroundDefault }]}>
          <View style={styles.cardHeader}>
            <View style={styles.badgesRow}>
              <View style={[styles.statusBadge, { backgroundColor: addAlpha(statusColor, 0.15) }]}>
                <Feather name={statusIcon} size={13} color={statusColor} />
                <ThemedText type="caption" style={{ color: statusColor, fontWeight: "700", marginRight: 4 }}>{item.status}</ThemedText>
              </View>
              {item.payment?.status === "paid" || item.paymentStatus === "مدفوع" ? (
                <View style={[styles.statusBadge, { backgroundColor: addAlpha("#16A34A", 0.15) }]}>
                  <Feather name="credit-card" size={12} color="#16A34A" />
                  <ThemedText type="caption" style={{ color: "#16A34A", fontWeight: "700", marginRight: 4 }}>مدفوع</ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.clinicRow}>
              <ThemedText type="h4" style={{ fontWeight: "700", textAlign: "right" }} numberOfLines={1}>{item.patientName}</ThemedText>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.details}>
            <View style={styles.detailItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.reason}</ThemedText>
              <Feather name="file-text" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            </View>
            <View style={styles.detailItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.date} — {item.time}</ThemedText>
              <Feather name="calendar" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            </View>
            {item.queueNumber ? (
              <View style={styles.detailItem}>
                <View style={[styles.queueBadge, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
                  <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>رقم الدور: {item.queueNumber}</ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        contentContainerStyle={[styles.list, { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!bookings.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="calendar"
              title="لا توجد حجوزات بعد"
              description="احجز موعدك مع أحد الأطباء الآن"
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  card: { borderRadius: BorderRadius.xl, padding: Spacing.xl },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.md },
  clinicRow: { flex: 1, alignItems: "flex-end", marginLeft: Spacing.sm },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  divider: { height: 1, marginVertical: Spacing.sm },
  details: { gap: Spacing.xs },
  detailItem: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  queueBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
});
