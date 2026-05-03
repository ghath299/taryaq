import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

type PharmacyStatus = "checking" | "available" | "unavailable";

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  hours: string;
  distanceKm: number;
  // إحداثيات نسبية داخل الخريطة (0..1)
  x: number;
  y: number;
  status: PharmacyStatus;
}

const INITIAL_PHARMACIES: Pharmacy[] = [
  { id: "p1", name: "صيدلية الشفاء",  address: "شارع فلسطين، مقابل جامع الزهراء",   hours: "مفتوحة 24 ساعة", distanceKm: 1.2, x: 0.20, y: 0.28, status: "checking" },
  { id: "p2", name: "صيدلية الحياة",   address: "شارع الصناعة، قرب الدفاع المدني", hours: "مفتوحة حتى 11 م", distanceKm: 1.7, x: 0.78, y: 0.22, status: "checking" },
  { id: "p3", name: "صيدلية الأمل",    address: "شارع النضال، مقابل مطعم الخليج",  hours: "مفتوحة حتى 12 ص", distanceKm: 2.1, x: 0.30, y: 0.78, status: "checking" },
  { id: "p4", name: "صيدلية النور",    address: "حي الكرادة، قرب البريد",          hours: "مفتوحة حتى 10 م", distanceKm: 2.4, x: 0.72, y: 0.74, status: "checking" },
  { id: "p5", name: "صيدلية البركة",   address: "شارع الرشيد، قرب المصرف",         hours: "مفتوحة حتى 9 م",  distanceKm: 2.4, x: 0.50, y: 0.12, status: "checking" },
];

// أول صيدلية ستردّ "متوفر" (لتثبيت السلوك في العرض التوضيحي)
const FIRST_AVAILABLE_ID = "p3";

export default function MedicineSearchMapScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState("Panadol Extra");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>(INITIAL_PHARMACIES);
  const [foundId, setFoundId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  // Reanimated shared values
  const radarScale = useSharedValue(0.4);
  const radarOpacity = useSharedValue(0.6);
  const pinFade = useSharedValue(0);
  const foundPulse = useSharedValue(1);
  const lineDash = useSharedValue(0);

  // ===== Animations lifecycle =====
  useEffect(() => {
    // دائرة البحث: تكبر تدريجياً ثم تعيد البدء
    radarScale.value = withRepeat(
      withTiming(1.05, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    radarOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 0 }),
        withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );

    // ظهور النقاط بعد 600ms
    pinFade.value = withDelay(600, withTiming(1, { duration: 700 }));

    // محاكاة ردود الصيدليات: بعض الصيدليات "غير متوفر" خلال 1.5–3 ثوانٍ
    const t1 = setTimeout(() => {
      setPharmacies((prev) =>
        prev.map((p) =>
          p.id === "p2" ? { ...p, status: "unavailable" } : p,
        ),
      );
    }, 1500);
    const t2 = setTimeout(() => {
      setPharmacies((prev) =>
        prev.map((p) =>
          p.id === "p4" ? { ...p, status: "unavailable" } : p,
        ),
      );
    }, 2400);

    // أول صيدلية متوفّرة بعد ~3.5s
    const t3 = setTimeout(() => {
      handleFound(FIRST_AVAILABLE_ID);
    }, 3500);

    // عدّاد الوقت المنقضي
    startedAtRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
      cancelAnimation(radarScale);
      cancelAnimation(radarOpacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRadar = () => {
    cancelAnimation(radarScale);
    cancelAnimation(radarOpacity);
    radarOpacity.value = withTiming(0, { duration: 300 });
  };

  const handleFound = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setFoundId(id);
    setPharmacies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "available" } : p)),
    );
    runOnJS(stopRadar)();
    // نبض مستمر على الصيدلية الموجودة
    foundPulse.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    // خط متقطع متحرك من المستخدم إلى الصيدلية
    lineDash.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
  };

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: radarScale.value }],
    opacity: radarOpacity.value,
  }));
  const pinFadeStyle = useAnimatedStyle(() => ({ opacity: pinFade.value }));
  const foundPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: foundPulse.value }],
    opacity: 0.4,
  }));

  // إحصائيات في الكارد العلوي
  const checkedCount = useMemo(
    () => pharmacies.filter((p) => p.status !== "checking").length || pharmacies.length,
    [pharmacies],
  );
  const elapsedFmt = useMemo(() => {
    const total = Math.floor(elapsedMs / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [elapsedMs]);

  const foundPharmacy = pharmacies.find((p) => p.id === foundId) ?? null;

  // ===== Subcomponents (inline) =====
  const cardBg = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";
  const mapBg = isDark ? "#0F1620" : "#EAF2FB";
  const waterColor = isDark ? "#0B2238" : "#CFE3F7";
  const landColor = isDark ? "#1A2434" : "#F3F8FE";
  const roadColor = isDark ? "#243149" : "#FFFFFF";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: subtleBorder }]}>
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={styles.headerBtn}
          >
            <Feather name="arrow-right" size={22} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800" }}>
          البحث عن علاج
        </ThemedText>
        <View style={styles.headerRight}>
          <Pressable style={[styles.iconBtn, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
            <Feather name="message-circle" size={18} color={theme.primaryDark} />
          </Pressable>
          <Pressable style={[styles.iconBtn, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
            <Feather name="sliders" size={18} color={theme.primaryDark} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <Feather name="mic" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="اكتب اسم الدواء أو المادة الفعّالة"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            textAlign="right"
          />
          <Feather name="search" size={18} color={theme.textSecondary} />
        </View>

        {/* Medicine info card */}
        <View style={[styles.medCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <View style={styles.medCardTop}>
            <Pressable style={[styles.changeBtn, { borderColor: theme.primary }]}>
              <Feather name="edit-2" size={12} color={theme.primaryDark} />
              <ThemedText type="caption" style={{ color: theme.primaryDark, marginRight: 4, fontWeight: "700" }}>
                تغيير
              </ThemedText>
            </Pressable>
            <View style={styles.medMeta}>
              <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>
                {query || "—"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "right" }}>
                باراسيتامول 500 ملغ
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>
                20 قرص
              </ThemedText>
            </View>
            <View style={[styles.medIcon, { backgroundColor: addAlpha(theme.primary, 0.12) }]}>
              <MaterialCommunityIcons name="pill" size={28} color={theme.primaryDark} />
            </View>
          </View>

          <View style={[styles.statusRow, { borderTopColor: subtleBorder }]}>
            {foundId ? (
              <ThemedText type="small" style={{ color: theme.success, fontWeight: "700" }}>
                ✓ تم العثور على صيدلية متوفّرة
              </ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700" }}>
                🔎 جارٍ البحث عن أقرب صيدلية متوفّرة...
              </ThemedText>
            )}
          </View>

          <View style={[styles.statsRow, { borderTopColor: subtleBorder }]}>
            <View style={styles.statItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>الوقت المتوقع</ThemedText>
              <ThemedText type="small" style={{ color: theme.text, fontWeight: "800" }}>
                {elapsedFmt} دقيقة
              </ThemedText>
            </View>
            <View style={[styles.statItemDivider, { backgroundColor: subtleBorder }]} />
            <View style={styles.statItem}>
              <Feather name="target" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>نصف القطر الحالي</ThemedText>
              <ThemedText type="small" style={{ color: theme.text, fontWeight: "800" }}>2.4 كم</ThemedText>
            </View>
            <View style={[styles.statItemDivider, { backgroundColor: subtleBorder }]} />
            <View style={styles.statItem}>
              <Feather name="check-circle" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>الصيدليات التي تم فحصها</ThemedText>
              <ThemedText type="small" style={{ color: theme.text, fontWeight: "800" }}>{checkedCount}</ThemedText>
            </View>
          </View>
        </View>

        {/* Map placeholder */}
        <View style={[styles.mapWrap, { backgroundColor: mapBg, borderColor: subtleBorder }]}>
          {/* خلفية شبيهة بخريطة */}
          <View style={[styles.mapLand, { backgroundColor: landColor }]} />
          <View style={[styles.mapRiver, { backgroundColor: waterColor }]} />
          <View style={[styles.mapRoadH, { backgroundColor: roadColor }]} />
          <View style={[styles.mapRoadV, { backgroundColor: roadColor }]} />

          {/* دوائر الرادار */}
          <View pointerEvents="none" style={styles.radarCenter}>
            <View
              style={[
                styles.radarStaticRing,
                { borderColor: addAlpha(theme.primary, 0.18) },
              ]}
            />
            <View
              style={[
                styles.radarStaticRingInner,
                { borderColor: addAlpha(theme.primary, 0.28) },
              ]}
            />
            <Animated.View
              style={[
                styles.radarPulse,
                { borderColor: theme.primary, backgroundColor: addAlpha(theme.primary, 0.12) },
                radarStyle,
              ]}
            />
            {/* نقطة المستخدم */}
            <View style={[styles.userDotOuter, { backgroundColor: "#FFFFFF" }]}>
              <View style={[styles.userDotInner, { backgroundColor: theme.primaryDark }]} />
            </View>
          </View>

          {/* الصيدليات على الخريطة */}
          {pharmacies.map((p) => (
            <Animated.View
              key={p.id}
              style={[
                styles.pinWrap,
                { left: `${p.x * 100}%`, top: `${p.y * 100}%` },
                pinFadeStyle,
              ]}
              pointerEvents="none"
            >
              {p.id === foundId && (
                <Animated.View
                  style={[
                    styles.pinPulse,
                    { backgroundColor: theme.success },
                    foundPulseStyle,
                  ]}
                />
              )}
              <View
                style={[
                  styles.pin,
                  {
                    backgroundColor:
                      p.id === foundId
                        ? theme.success
                        : p.status === "unavailable"
                          ? addAlpha(theme.error, 0.85)
                          : theme.primaryDark,
                  },
                ]}
              >
                <MaterialCommunityIcons name="hospital-box" size={14} color="#FFFFFF" />
              </View>
            </Animated.View>
          ))}

          {/* أزرار التحكم بالخريطة */}
          <View style={styles.mapControls}>
            <Pressable style={[styles.mapCtrlBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
              <Feather name="navigation" size={16} color={theme.primaryDark} />
            </Pressable>
            <Pressable style={[styles.mapCtrlBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
              <Feather name="plus" size={16} color={theme.text} />
            </Pressable>
            <Pressable style={[styles.mapCtrlBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
              <Feather name="minus" size={16} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {/* قائمة الصيدليات القريبة */}
        <View style={styles.listHeader}>
          <View style={styles.listHeaderRow}>
            <View style={[styles.countPill, { backgroundColor: addAlpha(theme.primary, 0.15) }]}>
              <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "800" }}>
                {pharmacies.length}
              </ThemedText>
            </View>
            <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800" }}>
              الصيدليات القريبة
            </ThemedText>
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", marginTop: 2 }}>
            {foundId ? "تم إيجاد صيدلية متوفّرة" : "البحث جارٍ في محيط 2.4 كم"}
          </ThemedText>
        </View>

        {pharmacies.map((p, i) => {
          const isFound = p.id === foundId;
          const statusColor =
            p.status === "available"
              ? theme.success
              : p.status === "unavailable"
                ? theme.error
                : theme.warning;
          const statusBg = addAlpha(statusColor, 0.12);
          const statusLabel =
            p.status === "available"
              ? "متوفر"
              : p.status === "unavailable"
                ? "غير متوفر"
                : "يتم التحقق...";
          const statusIcon =
            p.status === "available" ? "check" : p.status === "unavailable" ? "x" : "loader";

          return (
            <Animated.View
              key={p.id}
              entering={FadeInUp.delay(120 + i * 70).duration(400)}
              style={[
                styles.pharmacyCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isFound ? theme.success : subtleBorder,
                  borderWidth: isFound ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.pharmacyTop}>
                <View style={[styles.pharmacyIcon, { backgroundColor: addAlpha(statusColor, 0.15) }]}>
                  <MaterialCommunityIcons name="hospital-box" size={22} color={statusColor} />
                </View>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <ThemedText type="body" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", marginTop: 2 }}>
                    {p.address}
                  </ThemedText>
                  <View style={styles.pharmacyMetaRow}>
                    <Feather name="clock" size={12} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 4 }}>
                      {p.hours}
                    </ThemedText>
                  </View>
                </View>
                <Pressable accessibilityLabel="فتح الصيدلية" style={styles.openBtn}>
                  <Feather name="send" size={16} color={theme.primaryDark} />
                </Pressable>
              </View>

              <View style={[styles.pharmacyBottom, { borderTopColor: subtleBorder }]}>
                <View style={styles.distRow}>
                  <Feather name="map-pin" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 4 }}>
                    {p.distanceKm.toFixed(1)} كم
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                  <Feather name={statusIcon as any} size={12} color={statusColor} />
                  <ThemedText type="caption" style={{ color: statusColor, marginRight: 4, fontWeight: "700" }}>
                    {statusLabel}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* شريط النتيجة السفلي */}
      {foundPharmacy && (
        <Animated.View
          entering={FadeInDown.duration(450)}
          style={[
            styles.resultBar,
            {
              backgroundColor: cardBg,
              borderTopColor: subtleBorder,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              // مكان لاحق: الانتقال لشاشة الاتجاهات
            }}
            style={({ pressed }) => [styles.directionsBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={[theme.primary, theme.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.directionsGrad}
            >
              <Feather name="navigation" size={16} color="#FFFFFF" />
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "800", marginRight: 6 }}
              >
                عرض الاتجاهات
              </ThemedText>
            </LinearGradient>
          </Pressable>

          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>
              تم العثور على الصيدلية المناسبة!
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", marginTop: 2 }}>
              {foundPharmacy.name} متوفر فيها الدواء
            </ThemedText>
          </View>

          <View style={[styles.resultIcon, { backgroundColor: addAlpha(theme.success, 0.15) }]}>
            <MaterialCommunityIcons name="hospital-box" size={22} color={theme.success} />
          </View>
        </Animated.View>
      )}
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
  headerBtn: { padding: Spacing.xs },
  headerRight: { flexDirection: "row", gap: Spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Cairo-Regular",
    fontSize: 14,
  },

  medCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  medCardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  medMeta: { flex: 1, gap: 2 },
  medIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusRow: { paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "flex-end" },
  statsRow: {
    flexDirection: "row",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statItemDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },

  // Map
  mapWrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    height: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  mapLand: { ...StyleSheet.absoluteFillObject },
  mapRiver: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "55%",
    width: "10%",
    transform: [{ rotate: "12deg" }],
    borderRadius: 100,
  },
  mapRoadH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "60%",
    height: 4,
    opacity: 0.85,
  },
  mapRoadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "30%",
    width: 4,
    opacity: 0.85,
  },
  radarCenter: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  radarStaticRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    transform: [{ translateX: -100 }, { translateY: -100 }],
  },
  radarStaticRingInner: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    transform: [{ translateX: -60 }, { translateY: -60 }],
  },
  radarPulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    transform: [{ translateX: -110 }, { translateY: -110 }],
  },
  userDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -11 }, { translateY: -11 }],
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  userDotInner: { width: 12, height: 12, borderRadius: 6 },
  pinWrap: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -14 }, { translateY: -14 }],
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  pinPulse: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
  mapControls: {
    position: "absolute",
    right: Spacing.sm,
    top: Spacing.sm,
    gap: Spacing.xs,
  },
  mapCtrlBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  listHeader: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  listHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: Spacing.sm },
  countPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 26,
    alignItems: "center",
  },

  pharmacyCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  pharmacyTop: { flexDirection: "row", alignItems: "center" },
  pharmacyIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pharmacyMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  openBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pharmacyBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  distRow: { flexDirection: "row", alignItems: "center" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },

  resultBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  directionsBtn: { borderRadius: BorderRadius.full, overflow: "hidden" },
  directionsGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
});
