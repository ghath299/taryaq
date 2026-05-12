import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

interface HistoryItem {
  id: string;
  medicationName: string;
  activeIngredient: string;
  pharmacyName: string;
  status: "completed" | "cancelled" | "searching";
  price: number | null;
  createdAt: string;
}

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "r1",
    medicationName: "Panadol Extra",
    activeIngredient: "باراسيتامول 500 ملغ",
    pharmacyName: "صيدلية الشفاء",
    status: "completed",
    price: 2500,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "r2",
    medicationName: "Augmentin 625",
    activeIngredient: "أموكسيسيلين + حمض كلافولانيك",
    pharmacyName: "صيدلية النور",
    status: "completed",
    price: 7500,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "r3",
    medicationName: "Nexium 40mg",
    activeIngredient: "إيزوميبرازول 40 ملغ",
    pharmacyName: "صيدلية الحياة",
    status: "cancelled",
    price: null,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: "r4",
    medicationName: "Concor 5mg",
    activeIngredient: "بيزوبرولول 5 ملغ",
    pharmacyName: "صيدلية الأمل",
    status: "completed",
    price: 4000,
    createdAt: new Date(Date.now() - 86400000 * 21).toISOString(),
  },
  {
    id: "r5",
    medicationName: "Lipitor 20mg",
    activeIngredient: "أتورفاستاتين 20 ملغ",
    pharmacyName: "صيدلية البركة",
    status: "completed",
    price: 9000,
    createdAt: new Date(Date.now() - 86400000 * 35).toISOString(),
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatPrice(price: number) {
  return `${price.toLocaleString("ar-IQ")} د.ع`;
}

const STATUS_MAP = {
  completed: { label: "مكتمل", color: "#4CD964", icon: "check-circle" as const },
  cancelled: { label: "ملغى", color: "#FF6B6B", icon: "x-circle" as const },
  searching: { label: "جارٍ البحث", color: "#FFCC00", icon: "loader" as const },
};

export default function MedicationHistoryScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");

  const cardBg = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  const filtered = filter === "all" ? MOCK_HISTORY : MOCK_HISTORY.filter((h) => h.status === filter);

  const totalSpent = MOCK_HISTORY.filter((h) => h.status === "completed" && h.price)
    .reduce((sum, h) => sum + (h.price ?? 0), 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: subtleBorder }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button">
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800" }}>
          سجل طلباتي
        </ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.summaryCard, { backgroundColor: addAlpha(theme.primaryDark, 0.08), marginHorizontal: Spacing.lg, marginTop: Spacing.md }]}>
        <View style={styles.summaryItem}>
          <ThemedText type="h3" style={{ color: theme.primaryDark, fontWeight: "800", textAlign: "center" }}>
            {MOCK_HISTORY.filter((h) => h.status === "completed").length}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>طلب مكتمل</ThemedText>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: addAlpha(theme.primaryDark, 0.15) }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="h3" style={{ color: theme.primaryDark, fontWeight: "800", textAlign: "center" }}>
            {MOCK_HISTORY.length}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>إجمالي الطلبات</ThemedText>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: addAlpha(theme.primaryDark, 0.15) }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "800", textAlign: "center" }}>
            {formatPrice(totalSpent)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>إجمالي الإنفاق</ThemedText>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(["all", "completed", "cancelled"] as const).map((f) => {
          const labels = { all: "الكل", completed: "المكتملة", cancelled: "الملغاة" };
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: active ? theme.primaryDark : addAlpha(theme.primaryDark, 0.08),
                },
              ]}
            >
              <ThemedText
                type="caption"
                style={{ color: active ? "#fff" : theme.textSecondary, fontWeight: "700" }}
              >
                {labels[f]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="clipboard-text-off" size={64} color={addAlpha(theme.textSecondary, 0.4)} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              لا توجد طلبات بهذه الفئة
            </ThemedText>
          </View>
        ) : (
          filtered.map((item, i) => {
            const s = STATUS_MAP[item.status];
            return (
              <Animated.View
                key={item.id}
                entering={FadeInUp.delay(60 + i * 60).duration(400)}
                style={[styles.card, { backgroundColor: cardBg, borderColor: subtleBorder }]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.medIcon, { backgroundColor: addAlpha(s.color, 0.12) }]}>
                    <MaterialCommunityIcons name="pill" size={22} color={s.color} />
                  </View>
                  <View style={{ flex: 1, marginRight: Spacing.md }}>
                    <ThemedText type="body" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>
                      {item.medicationName}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", marginTop: 2 }}>
                      {item.activeIngredient}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: addAlpha(s.color, 0.12) }]}>
                    <Feather name={s.icon} size={12} color={s.color} />
                    <ThemedText type="caption" style={{ color: s.color, fontWeight: "700", marginRight: 4 }}>
                      {s.label}
                    </ThemedText>
                  </View>
                </View>

                <View style={[styles.cardMeta, { borderTopColor: subtleBorder }]}>
                  <View style={styles.metaItem}>
                    <Feather name="calendar" size={12} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 4 }}>
                      {formatDate(item.createdAt)}
                    </ThemedText>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="map-pin" size={12} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 4 }}>
                      {item.pharmacyName}
                    </ThemedText>
                  </View>
                  {item.price != null && (
                    <View style={[styles.priceBadge, { backgroundColor: addAlpha(theme.primaryDark, 0.1) }]}>
                      <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "800" }}>
                        {formatPrice(item.price)}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {item.status === "completed" && (
                  <Pressable
                    onPress={() =>
                      Alert.alert("إعادة الطلب", `سيتم البحث عن ${item.medicationName} من جديد`, [
                        { text: "إلغاء", style: "cancel" },
                        { text: "ابحث الآن", onPress: () => router.push("/medicine-search") },
                      ])
                    }
                    style={[styles.reorderBtn, { borderColor: theme.primaryDark }]}
                  >
                    <Feather name="refresh-cw" size={12} color={theme.primaryDark} />
                    <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "700", marginRight: 4 }}>
                      إعادة الطلب
                    </ThemedText>
                  </Pressable>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: Spacing.xs, width: 36 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36 },
  filterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  emptyWrap: { alignItems: "center", paddingTop: 60 },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  medIcon: { width: 46, height: 46, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  metaItem: { flexDirection: "row", alignItems: "center" },
  priceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
});
