import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

interface Medication {
  id: string;
  medicationName: string;
  activeIngredient: string;
  dailyDoses: number;
  pillsPerDose: number;
  pillsInBox: number;
  isChronic: boolean;
  startDate: string;
  endDate: string | null;
  lastPharmacyName: string;
  daysLeft: number | null;
}

const MOCK_MEDICATIONS: Medication[] = [
  {
    id: "m1",
    medicationName: "Concor 5mg",
    activeIngredient: "بيزوبرولول 5 ملغ",
    dailyDoses: 1,
    pillsPerDose: 1,
    pillsInBox: 28,
    isChronic: true,
    startDate: new Date(Date.now() - 86400000 * 10).toISOString(),
    endDate: null,
    lastPharmacyName: "صيدلية النور",
    daysLeft: null,
  },
  {
    id: "m2",
    medicationName: "Augmentin 625",
    activeIngredient: "أموكسيسيلين + حمض كلافولانيك",
    dailyDoses: 2,
    pillsPerDose: 1,
    pillsInBox: 14,
    isChronic: false,
    startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    lastPharmacyName: "صيدلية الشفاء",
    daysLeft: 2,
  },
  {
    id: "m3",
    medicationName: "Nexium 40mg",
    activeIngredient: "إيزوميبرازول 40 ملغ",
    dailyDoses: 1,
    pillsPerDose: 1,
    pillsInBox: 30,
    isChronic: true,
    startDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    endDate: null,
    lastPharmacyName: "صيدلية الحياة",
    daysLeft: null,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function MyMedicationsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [medications] = useState<Medication[]>(MOCK_MEDICATIONS);

  const cardBg       = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  // Meds with ≤2 days remaining
  const expiringMeds = medications.filter(
    (m) => m.daysLeft !== null && m.daysLeft <= 2,
  );

  // ── Send immediate push notifications for expiring meds on mount ────────────
  useEffect(() => {
    if (Platform.OS === "web" || expiringMeds.length === 0) return;
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") return;
      }
      for (const med of expiringMeds) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ دواؤك على وشك النفاد",
            body: `${med.medicationName} — متبقي ${med.daysLeft} ${med.daysLeft === 1 ? "يوم" : "أيام"} فقط. اطلبه الآن!`,
            sound: true,
          },
          trigger: null,
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReorder = (med: Medication) => {
    Alert.alert(
      "إعادة الطلب",
      `هل تريد طلب ${med.medicationName} من ${med.lastPharmacyName}؟`,
      [
        { text: "لا", style: "cancel" },
        { text: "نعم، ابحث", onPress: () => router.push("/medicine-search") },
      ],
    );
  };

  const chronic   = medications.filter((m) =>  m.isChronic);
  const temporary = medications.filter((m) => !m.isChronic);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: subtleBorder }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button">
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800" }}>
          أدويتي الدائمة
        </ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Expiry warning banner ─────────────────────────────────────────── */}
        {expiringMeds.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[
              styles.warningBanner,
              { backgroundColor: addAlpha(theme.error, 0.1), borderColor: theme.error },
            ]}
          >
            <View style={[styles.warningIcon, { backgroundColor: addAlpha(theme.error, 0.15) }]}>
              <Feather name="alert-triangle" size={20} color={theme.error} />
            </View>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <ThemedText type="small" style={{ color: theme.error, fontWeight: "800", textAlign: "right" }}>
                {expiringMeds.length === 1
                  ? `${expiringMeds[0].medicationName} ينتهي خلال ${expiringMeds[0].daysLeft} ${expiringMeds[0].daysLeft === 1 ? "يوم" : "أيام"}!`
                  : `${expiringMeds.length} أدوية تنتهي خلال يومين!`}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.error, textAlign: "right", marginTop: 2 }}>
                اطلبها الآن قبل أن تنتهي
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push("/medicine-search")}
              style={[styles.warningBtn, { borderColor: theme.error }]}
            >
              <ThemedText type="caption" style={{ color: theme.error, fontWeight: "800" }}>
                اطلب الآن
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}

        {medications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="pill-off" size={64} color={addAlpha(theme.textSecondary, 0.4)} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              لا يوجد أدوية محفوظة حتى الآن
            </ThemedText>
            <Pressable
              onPress={() => router.push("/medicine-search")}
              style={[styles.searchBtn, { backgroundColor: theme.primaryDark }]}
            >
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "700" }}>ابحث عن دواء</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {chronic.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="hospital-box" size={16} color={theme.primaryDark} />
                  <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700", marginRight: 6 }}>
                    الأدوية المزمنة ({chronic.length})
                  </ThemedText>
                </View>
                {chronic.map((med, i) => (
                  <MedCard
                    key={med.id}
                    med={med}
                    index={i}
                    cardBg={cardBg}
                    subtleBorder={subtleBorder}
                    theme={theme}
                    onReorder={handleReorder}
                  />
                ))}
              </>
            )}

            {temporary.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                  <MaterialCommunityIcons name="pill" size={16} color="#F97316" />
                  <ThemedText type="small" style={{ color: "#F97316", fontWeight: "700", marginRight: 6 }}>
                    أدوية مؤقتة ({temporary.length})
                  </ThemedText>
                </View>
                {temporary.map((med, i) => (
                  <MedCard
                    key={med.id}
                    med={med}
                    index={chronic.length + i}
                    cardBg={cardBg}
                    subtleBorder={subtleBorder}
                    theme={theme}
                    onReorder={handleReorder}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.fab, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable onPress={() => router.push("/medicine-search")} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGrad}>
            <Feather name="search" size={18} color="#fff" />
            <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 8 }}>اطلب دواءً جديداً</ThemedText>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── MedCard ───────────────────────────────────────────────────────────────────

interface MedCardProps {
  med: Medication;
  index: number;
  cardBg: string;
  subtleBorder: string;
  theme: ReturnType<typeof useTheme>["theme"];
  onReorder: (med: Medication) => void;
}

function MedCard({ med, index, cardBg, subtleBorder, theme, onReorder }: MedCardProps) {
  // Warn if ≤2 days left
  const isExpiring  = med.daysLeft !== null && med.daysLeft <= 2;
  const isLow       = med.daysLeft !== null && med.daysLeft <= 5 && !isExpiring;
  const statusColor = med.isChronic ? theme.primaryDark : isExpiring ? theme.error : isLow ? theme.warning : theme.success;
  const statusBg    = addAlpha(statusColor, 0.1);
  const statusLabel = med.isChronic
    ? "مزمن"
    : isExpiring
    ? `⚠️ ${med.daysLeft} أيام فقط!`
    : isLow
    ? `${med.daysLeft} أيام متبقية`
    : "جارٍ";

  const borderColor = isExpiring ? theme.error : subtleBorder;
  const borderWidth = isExpiring ? 1.5 : 1;

  return (
    <Animated.View
      entering={FadeInUp.delay(80 + index * 60).duration(400)}
      style={[styles.card, { backgroundColor: cardBg, borderColor, borderWidth }]}
    >
      {/* Expiry warning strip */}
      {isExpiring && (
        <View style={[styles.expiryStrip, { backgroundColor: addAlpha(theme.error, 0.1) }]}>
          <Feather name="alert-triangle" size={13} color={theme.error} />
          <ThemedText type="caption" style={{ color: theme.error, fontWeight: "800", marginRight: 6, textAlign: "right" }}>
            تحذير: الدواء سينتهي خلال {med.daysLeft} {med.daysLeft === 1 ? "يوم" : "أيام"} — اطلبه الآن
          </ThemedText>
        </View>
      )}

      <View style={styles.cardTop}>
        <View style={[styles.medIcon, { backgroundColor: addAlpha(statusColor, 0.12) }]}>
          <MaterialCommunityIcons name="pill" size={24} color={statusColor} />
        </View>
        <View style={{ flex: 1, marginRight: Spacing.md }}>
          <ThemedText type="body" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>
            {med.medicationName}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", marginTop: 2 }}>
            {med.activeIngredient}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <ThemedText type="caption" style={{ color: statusColor, fontWeight: "700" }}>
            {statusLabel}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.doseRow, { borderTopColor: subtleBorder }]}>
        <DoseStat label="مرات/يوم"   value={String(med.dailyDoses)}   theme={theme} />
        <View style={[styles.divider, { backgroundColor: subtleBorder }]} />
        <DoseStat label="أقراص/مرة"  value={String(med.pillsPerDose)} theme={theme} />
        <View style={[styles.divider, { backgroundColor: subtleBorder }]} />
        <DoseStat label="في العلبة"  value={`${med.pillsInBox} قرص`}  theme={theme} />
      </View>

      <View style={[styles.cardBottom, { borderTopColor: subtleBorder }]}>
        <Pressable
          onPress={() => onReorder(med)}
          style={[
            styles.reorderBtn,
            { backgroundColor: isExpiring ? addAlpha(theme.error, 0.12) : addAlpha(theme.primaryDark, 0.1) },
          ]}
        >
          <Feather name="refresh-cw" size={12} color={isExpiring ? theme.error : theme.primaryDark} />
          <ThemedText type="caption" style={{ color: isExpiring ? theme.error : theme.primaryDark, fontWeight: "700", marginRight: 4 }}>
            {isExpiring ? "اطلب الآن!" : "إعادة الطلب"}
          </ThemedText>
        </Pressable>
        <View style={styles.pharmacyRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>{med.lastPharmacyName}</ThemedText>
          <Feather name="map-pin" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
        </View>
      </View>
    </Animated.View>
  );
}

function DoseStat({ label, value, theme }: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText type="small"   style={{ color: theme.text, fontWeight: "800" }}>{value}</ThemedText>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { padding: Spacing.xs, width: 36 },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  warningIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  warningBtn:  { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1.5 },

  emptyWrap:  { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: Spacing.xl },
  searchBtn:  { marginTop: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },

  card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, overflow: "hidden" },

  expiryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 6,
  },

  cardTop:     { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  medIcon:     { width: 48, height: 48, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },

  doseRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  divider: { width: StyleSheet.hairlineWidth, height: 32 },

  cardBottom:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  reorderBtn:  { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  pharmacyRow: { flexDirection: "row", alignItems: "center" },

  fab:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, backgroundColor: "transparent" },
  fabGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.full, gap: Spacing.sm },
});
