import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { AnimatedCard } from "@/components/AnimatedCard";
import EmergencyModal from "@/components/EmergencyModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { doctors } from "@/data/mockData";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");

const promoSlides = [
  {
    id: "1",
    titleAr: "احجز موعدك بسهولة",
    descAr: "أكثر من 500 طبيب متاح في جميع محافظات العراق",
    gradient: ["#5EDFFF", "#1F6AE1"] as [string, string],
    icon: "calendar" as const,
  },
  {
    id: "2",
    titleAr: "أطباء موثوقون",
    descAr: "جميع الأطباء معتمدون ومرخصون من وزارة الصحة",
    gradient: ["#1F6AE1", "#0D4B99"] as [string, string],
    icon: "shield" as const,
  },
  {
    id: "3",
    titleAr: "تذكيرات فورية",
    descAr: "نرسل لك تذكيراً قبل موعدك لتكون جاهزاً",
    gradient: ["#0D4B99", "#5EDFFF"] as [string, string],
    icon: "bell" as const,
  },
];

const healthTips = [
  { id: "1", icon: "droplet" as const, titleAr: "اشرب الماء", descAr: "8 أكواب يومياً تحسّن وظائف الكلى وتطرد السموم", color: "#5EDFFF" },
  { id: "2", icon: "wind" as const, titleAr: "التنفس العميق", descAr: "5 دقائق صباحاً تقلل التوتر وتحسّن التركيز", color: "#1F6AE1" },
  { id: "3", icon: "sun" as const, titleAr: "فيتامين D", descAr: "15 دقيقة في الشمس يومياً تعزز المناعة", color: "#FFCC00" },
  { id: "4", icon: "activity" as const, titleAr: "المشي اليومي", descAr: "30 دقيقة مشي تحرق السعرات وتصفي الذهن", color: "#4CD964" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { t } = useApp();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const slideRef = useRef<FlatList>(null);
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseValue = useSharedValue(1);
  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseValue.value }] }));

  useEffect(() => {
    slideTimer.current = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % promoSlides.length;
        try { slideRef.current?.scrollToIndex({ index: next, animated: true }); } catch {}
        return next;
      });
    }, 3500);
    return () => { if (slideTimer.current) clearInterval(slideTimer.current); };
  }, []);

  const firstName = user?.fullName?.split(" ")[0] ?? "مريض";

  const quickActions = [
    { id: "bookings", icon: "calendar" as const, labelAr: "حجوزاتي", color: theme.primary, onPress: () => router.push("/bookings") },
    { id: "search", icon: "search" as const, labelAr: "بحث", color: theme.primaryDark, onPress: () => router.push("/search") },
    { id: "emergency", icon: "alert-triangle" as const, labelAr: "طوارئ", color: "#FF4B4B", onPress: () => setEmergencyVisible(true) },
    { id: "career", icon: "briefcase" as const, labelAr: "انضم", color: "#4CD964", onPress: () => router.push("/career-join") },
  ];

  const renderPromoSlide = ({ item }: { item: typeof promoSlides[0] }) => (
    <LinearGradient
      colors={item.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.promoSlide, { width: SCREEN_W - Spacing.xl * 2 }]}
    >
      <View style={styles.promoContent}>
        <View style={styles.promoTextArea}>
          <ThemedText type="h3" style={styles.promoTitle}>{item.titleAr}</ThemedText>
          <ThemedText type="small" style={styles.promoDesc}>{item.descAr}</ThemedText>
        </View>
        <View style={[styles.promoIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Feather name={item.icon} size={36} color="#FFF" />
        </View>
      </View>
      <View style={styles.promoDots}>
        {promoSlides.map((_, idx) => (
          <View key={idx} style={[styles.dot, { backgroundColor: idx === currentSlide ? "#FFF" : "rgba(255,255,255,0.4)", width: idx === currentSlide ? 20 : 6 }]} />
        ))}
      </View>
    </LinearGradient>
  );

  const renderDoctor = useCallback(({ item, index }: { item: typeof doctors[0]; index: number }) => (
    <AnimatedCard
      index={index}
      onPress={() => router.push(`/doctor/${item.id}`)}
      style={[styles.doctorCard, { width: 155 }]}
    >
      <View style={styles.doctorCardInner}>
        <View style={[styles.doctorAvatar, { backgroundColor: addAlpha(theme.primary, 0.08) }]}>
          <Feather name="user" size={30} color={theme.primary} />
          {item.isVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: theme.primary }]}>
              <Feather name="check" size={8} color="#FFF" />
            </View>
          )}
        </View>
        <ThemedText type="small" style={styles.doctorName} numberOfLines={2}>{item.nameAr}</ThemedText>
        <ThemedText type="caption" style={[styles.doctorSpec, { color: theme.primary }]} numberOfLines={1}>{item.specialtyAr}</ThemedText>
        <View style={styles.ratingRow}>
          <Feather name="star" size={11} color="#FFCC00" />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 2 }}>{item.rating}</ThemedText>
        </View>
        <View style={[styles.bookChip, { backgroundColor: theme.primary }]}>
          <ThemedText type="caption" style={{ color: isDark ? "#000" : "#FFF", fontWeight: "700" }}>احجز</ThemedText>
        </View>
      </View>
    </AnimatedCard>
  ), [theme, isDark, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
      >
        <Animated.View entering={FadeIn.duration(300)} style={[styles.headerSection, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Animated.View style={pulseStyle}>
                <Pressable onPress={() => setEmergencyVisible(true)} style={[styles.emergencyBtn, { backgroundColor: addAlpha("#FF4B4B", 0.12), borderColor: addAlpha("#FF4B4B", 0.25) }]}>
                  <Feather name="alert-triangle" size={20} color="#FF4B4B" />
                </Pressable>
              </Animated.View>
              <Pressable onPress={() => router.push("/notifications")} style={[styles.notifBtn, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
                <Feather name="bell" size={20} color={theme.primary} />
                <View style={[styles.notifBadge, { backgroundColor: "#FF4B4B" }]}>
                  <ThemedText type="caption" style={{ color: "#FFF", fontSize: 9, fontWeight: "700" }}>3</ThemedText>
                </View>
              </Pressable>
            </View>
            <View style={styles.greetingArea}>
              <ThemedText type="small" style={[styles.greetingLabel, { color: theme.textSecondary }]}>أهلاً 👋</ThemedText>
              <ThemedText type="h2" style={[styles.greetingName, { color: theme.text }]}>{firstName}</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.slidesSection}>
          <FlatList
            ref={slideRef}
            data={promoSlides}
            renderItem={renderPromoSlide}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
            scrollEnabled={false}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.quickActionsSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>الخدمات السريعة</ThemedText>
          <View style={styles.quickGrid}>
            {quickActions.map((action, i) => (
              <Animated.View key={action.id} entering={FadeInUp.delay(250 + i * 60).duration(350)}>
                <Pressable
                  onPress={action.onPress}
                  style={[styles.quickItem, { backgroundColor: isDark ? theme.card : "#FFF" }]}
                >
                  <LinearGradient
                    colors={[addAlpha(action.color, 0.15), addAlpha(action.color, 0.06)]}
                    style={[styles.quickIcon, { borderColor: addAlpha(action.color, 0.2) }]}
                  >
                    <Feather name={action.icon} size={24} color={action.color} />
                  </LinearGradient>
                  <ThemedText type="caption" style={[styles.quickLabel, { color: theme.text }]}>{action.labelAr}</ThemedText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.promotedSection}>
          <View style={styles.sectionHeader}>
            <Pressable onPress={() => router.push("/(tabs)/doctors" as any)}>
              <ThemedText type="small" style={{ color: theme.primary }}>عرض الكل</ThemedText>
            </Pressable>
            <ThemedText type="h4" style={styles.sectionTitle}>{t("promotedDoctors")}</ThemedText>
          </View>
          <FlatList
            data={doctors.slice(0, 5)}
            renderItem={renderDoctor}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}
            scrollEnabled={!!(doctors.length)}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(450).duration(400)} style={[styles.tipsSection, { paddingHorizontal: Spacing.xl }]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { marginBottom: Spacing.md }]}>{t("healthTips")}</ThemedText>
          <View style={styles.tipsGrid}>
            {healthTips.map((tip, i) => (
              <Animated.View key={tip.id} entering={FadeInUp.delay(500 + i * 80).duration(350)}>
                <Pressable style={[styles.tipCard, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
                  <View style={[styles.tipIcon, { backgroundColor: addAlpha(tip.color, 0.12) }]}>
                    <Feather name={tip.icon} size={20} color={tip.color} />
                  </View>
                  <ThemedText type="small" style={[styles.tipTitle, { color: theme.text }]}>{tip.titleAr}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right", lineHeight: 18 }} numberOfLines={2}>{tip.descAr}</ThemedText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <EmergencyModal visible={emergencyVisible} onClose={() => setEmergencyVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  emergencyBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  greetingArea: { alignItems: "flex-end" },
  greetingLabel: { marginBottom: 2 },
  greetingName: { fontWeight: "800" },
  slidesSection: { marginBottom: Spacing.xl },
  promoSlide: { borderRadius: BorderRadius.xl, padding: Spacing["2xl"] },
  promoContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  promoTextArea: { flex: 1, marginLeft: Spacing.lg },
  promoTitle: { color: "#FFF", fontWeight: "800", marginBottom: 4 },
  promoDesc: { color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  promoIconWrap: { width: 70, height: 70, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  promoDots: { flexDirection: "row", justifyContent: "flex-end", gap: 4, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  quickActionsSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { textAlign: "right", fontWeight: "700", marginBottom: Spacing.md },
  quickGrid: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
  quickItem: { flex: 1, alignItems: "center", borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  quickIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  quickLabel: { fontWeight: "600", textAlign: "center", fontSize: 12 },
  promotedSection: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  doctorCard: { marginVertical: 4 },
  doctorCardInner: { padding: Spacing.md, alignItems: "center", gap: 6 },
  doctorAvatar: { width: 65, height: 65, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  verifiedBadge: { position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  doctorName: { textAlign: "center", fontWeight: "600", lineHeight: 18 },
  doctorSpec: { textAlign: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  bookChip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 12 },
  tipsSection: { marginBottom: Spacing.lg },
  tipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  tipCard: { width: (SCREEN_W - Spacing.xl * 2 - Spacing.md) / 2, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  tipIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tipTitle: { fontWeight: "700", textAlign: "right" },
});
