import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Text,
} from "react-native";
import { Image } from "expo-image";
import InitialsAvatar from "@/components/InitialsAvatar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import EmergencyModal from "@/components/EmergencyModal";
import { AdsCarousel, type AdSlide } from "@/components/AdsCarousel";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { doctors as mockDoctors } from "@/data/mockData";
import { Spacing, addAlpha } from "@/constants/colors";
import { getRandomTips } from "@/data/healthTips";
import {
  fetchHealthSummary,
  saveHealthCache,
  loadHealthCache,
  type HealthSummary,
} from "@/services/healthDataService";
import {
  getSmartHealthTip,
  getActivityLabel,
  getStatusColor,
  getActivityBarPercent,
} from "@/services/smartHealthAnalyzer";
import HealthPermissionModal from "@/components/HealthPermissionModal";

const BRAND_BLUE = "#2A4FCC";
const BRAND_BLUE_DEEP = "#1F40C8";
const BANNER_CYAN = "#5CC4E6";
const BRAND_PURPLE = "#A78BFA";
const ICON_CYAN = "#3FC8E5";
const SOFT_BG = "#F5F7FB";
const METRIC_BG = "#F4F6FA";

function getScoreBadgeBg(score: number): string {
  if (score >= 80) return "#22C55E";
  if (score >= 60) return "#F97316";
  return "#EAB308";
}

const doctorImages: Record<string, ReturnType<typeof require>> = {
  "1": require("@/assets/images/doctor-ahmed.png"),
  "2": require("@/assets/images/doctor-sara.png"),
  "3": require("@/assets/images/doctor-ali.png"),
};

const featuredDoctorIds = ["2", "1", "3"];

const adsSlides: AdSlide[] = [
  {
    id: "ad-doctor",
    title: "احجز طبيبك خلال\nثواني",
    subtitle: "أو ابحث عن طبيب قريب منك",
    ctaLabel: "ابدأ الآن",
    ctaRoute: "/(tabs)/doctors",
    image: require("@/assets/images/banner-phone.png"),
    gradient: ["#1F40C8", "#2A4FCC", "#5CC4E6"],
  },
  {
    id: "ad-pharmacy",
    title: "صيدليات قريبة\nمنك دائماً",
    subtitle: "اطلب دواءك ووصلك للباب",
    ctaLabel: "اكتشف",
    ctaRoute: "/(tabs)/medicines",
    image: require("@/assets/images/water-glass.png"),
    gradient: ["#7C3AED", "#9F67F0", "#C4B5FD"],
  },
  {
    id: "ad-consult",
    title: "استشارة فورية\nمع طبيب",
    subtitle: "تواصل مباشر بضغطة واحدة",
    ctaLabel: "ابدأ استشارة",
    ctaRoute: "/(tabs)/doctors",
    image: require("@/assets/images/doctor-consultation.png"),
    gradient: ["#0E9488", "#14B8A6", "#5EEAD4"],
  },
  {
    id: "ad-health",
    title: "صحتك تحت\nحمايتنا",
    subtitle: "تابع مؤشراتك الصحية بسهولة",
    ctaLabel: "اعرف المزيد",
    ctaRoute: "/(tabs)/doctors",
    image: require("@/assets/images/health-shield.png"),
    gradient: ["#0369A1", "#0EA5E9", "#7DD3FC"],
  },
];

interface QuickService {
  id: string;
  labelAr: string;
  iconLib: "feather" | "mci";
  icon: string;
  color: string;
  route: string;
}

const quickServices: QuickService[] = [
  { id: "prescription", labelAr: "تصوير وصفة", iconLib: "feather", icon: "camera", color: ICON_CYAN, route: "/search" },
  { id: "pharmacy", labelAr: "أستكشف ", iconLib: "feather", icon: "map-pin", color: BRAND_BLUE, route: "/osm-map" },
  { id: "medicine", labelAr: "البحث عن دواء", iconLib: "mci", icon: "pill", color: BRAND_PURPLE, route: "/search" },
  { id: "doctor", labelAr: "حجز طبيب", iconLib: "mci", icon: "stethoscope", color: ICON_CYAN, route: "/(tabs)/doctors" },
];

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [permModalVisible, setPermModalVisible] = useState(false);
  const [healthData, setHealthData] = useState<HealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(false);

  // ── Health Data ────────────────────────────────────────────────────────────
  const barWidth = useSharedValue(0);
  const heartScale = useSharedValue(1);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  }));
  const heartPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const pulseStarted = useRef(false);

  const applyHealthData = useCallback(
    (data: HealthSummary) => {
      setHealthData(data);
      setHealthLoading(false);
      setHealthError(false);
      const target = getActivityBarPercent(data.activity.level);
      barWidth.value = withTiming(target, { duration: 900, easing: Easing.out(Easing.ease) });
      if (!pulseStarted.current) {
        pulseStarted.current = true;
        heartScale.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 700 }),
            withTiming(1.0, { duration: 700 }),
          ),
          -1,
          false,
        );
      }
      const smartTip = getSmartHealthTip(data);
      sessionTips.current = [smartTip, ...sessionTips.current.slice(0, 9)];
      setVisibleTip(smartTip);
      setTipIndex(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const retryHealth = useCallback(() => {
    setHealthError(false);
    setHealthLoading(true);
    fetchHealthSummary()
      .then(async (data) => {
        applyHealthData(data);
        await saveHealthCache(data);
      })
      .catch(() => {
        setHealthError(true);
        setHealthLoading(false);
      });
  }, [applyHealthData]);

  useEffect(() => {
    // ١. تحميل البيانات المؤقتة فوراً (إن وجدت)
    loadHealthCache().then((cached) => {
      if (cached) applyHealthData(cached.data);
    });
    // ٢. جلب بيانات حديثة
    fetchHealthSummary()
      .then(async (data) => {
        applyHealthData(data);
        await saveHealthCache(data);
      })
      .catch(() => {
        setHealthError(true);
        setHealthLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Rotating Tips ──────────────────────────────────────────────────────────
  const sessionTips = useRef<string[]>(getRandomTips(10));
  const [tipIndex, setTipIndex] = useState(0);
  const [visibleTip, setVisibleTip] = useState(sessionTips.current[0]);
  const tipOpacity = useSharedValue(1);
  const tipTranslateY = useSharedValue(0);

  const advanceTip = useCallback(() => {
    const next = (tipIndex + 1) % sessionTips.current.length;
    // Fade + slide out
    tipOpacity.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.ease) });
    tipTranslateY.value = withTiming(-12, { duration: 350, easing: Easing.out(Easing.ease) }, () => {
      runOnJS(setVisibleTip)(sessionTips.current[next]);
      runOnJS(setTipIndex)(next);
      // Snap to below, then fade + slide in
      tipTranslateY.value = 14;
      tipOpacity.value = 0;
      tipOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      tipTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
    });
  }, [tipIndex, tipOpacity, tipTranslateY]);

  useEffect(() => {
    const interval = setInterval(advanceTip, 3500 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, [advanceTip]);

  const tipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tipOpacity.value,
    transform: [{ translateY: tipTranslateY.value }],
  }));
  // ──────────────────────────────────────────────────────────────────────────

  const firstName = user?.fullName?.split(" ")[0] ?? "صديقي";
  const cardBg = isDark ? theme.card : "#FFFFFF";
  const screenBg = isDark ? theme.backgroundRoot : SOFT_BG;
  const textPrimary = isDark ? "#F2F4F7" : "#1A1F2E";
  const textSecondary = isDark ? addAlpha("#FFFFFF", 0.55) : "#6B7280";
  const subtleBorder = isDark ? addAlpha("#FFFFFF", 0.05) : "rgba(15,23,42,0.04)";
  const metricBg = isDark ? addAlpha("#FFFFFF", 0.04) : METRIC_BG;

  const featuredDoctors = featuredDoctorIds
    .map((id) => mockDoctors.find((d) => d.id === id))
    .filter(Boolean) as typeof mockDoctors;

  const renderQuickIcon = (svc: QuickService) => {
    if (svc.iconLib === "mci") {
      return (
        <MaterialCommunityIcons
          name={svc.icon as never}
          size={26}
          color={svc.color}
        />
      );
    }
    return <Feather name={svc.icon as never} size={24} color={svc.color} />;
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}
      >
        {/* HEADER */}
        <Animated.View
          style={[
            styles.header,
            { paddingTop: Platform.OS === "web" ? 60 : 12 },
          ]}
        >
          <Pressable
            onPress={() => router.push("/profile")}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="الملف الشخصي والإعدادات"
            hitSlop={6}
          >
            {user?.avatarUri ? (
              <Image
                source={{ uri: user.avatarUri }}
                style={styles.avatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <InitialsAvatar name={user?.fullName ?? ""} size={50} />
            )}
          </Pressable>

          <View style={styles.greetingArea}>
            <View style={styles.greetingTopRow}>
              <ThemedText
                type="h3"
                style={[styles.greetingHello, { color: textPrimary }]}
              >
                {`أهلاً ${firstName}`}
              </ThemedText>
              <ThemedText type="h3" style={styles.wave}>
                {" 👋"}
              </ThemedText>
            </View>
            <View style={styles.greetingSubRow}>
              <ThemedText
                type="small"
                style={{ color: textSecondary, marginLeft: 2 }}
              >
                كيف صحتك اليوم؟
              </ThemedText>
            </View>
          </View>

          <View style={styles.bellWrap}>
            <Pressable
              onPress={() => router.push("/notifications")}
              style={[
                styles.bellBtn,
                { backgroundColor: cardBg, borderColor: subtleBorder },
              ]}
              accessibilityRole="button"
              accessibilityLabel="الإشعارات، 3 جديدة"
              hitSlop={8}
            >
              <Feather name="bell" size={20} color={textPrimary} />
            </Pressable>
            <View style={styles.bellBadge}>
              <ThemedText
                type="caption"
                style={styles.bellBadgeText}
              >
                3
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* SEARCH BAR */}
        <Animated.View
          style={styles.searchSection}
        >
          <Pressable
            style={[
              styles.searchBar,
              { backgroundColor: cardBg, borderColor: subtleBorder, flex: 1 },
            ]}
            onPress={() => router.push("/search")}
            accessibilityRole="search"
            accessibilityLabel="ابحث عن طبيب"
          >
            <Feather name="search" size={18} color={textSecondary} />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="ابحث عن طبيب..."
              placeholderTextColor={textSecondary}
              style={[styles.searchInput, { color: textPrimary }]}
              onFocus={() => router.push("/search")}
              showSoftInputOnFocus={false}
            />
          </Pressable>
        </Animated.View>

        {/* HERO ADS CAROUSEL */}
        <Animated.View
          style={styles.bannerWrap}
        >
          <AdsCarousel slides={adsSlides} horizontalPadding={0} />
        </Animated.View>

        {/* QUICK SERVICES */}
        <Animated.View
          style={styles.quickRow}
        >
          {quickServices.map((svc, i) => (
            <Animated.View
              key={svc.id}
              style={styles.quickItemWrap}
            >
              <Pressable
                onPress={() => router.push(svc.route as never)}
                style={[
                  styles.quickItem,
                  { backgroundColor: cardBg, borderColor: subtleBorder },
                ]}
                accessibilityRole="button"
                accessibilityLabel={svc.labelAr}
              >
                <View
                  style={[
                    styles.quickIconBg,
                    { backgroundColor: addAlpha(svc.color, 0.13) },
                  ]}
                >
                  {renderQuickIcon(svc)}
                </View>
                <ThemedText
                  type="caption"
                  style={[styles.quickLabel, { color: textPrimary }]}
                  numberOfLines={1}
                >
                  {svc.labelAr}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>

        {/* FEATURED DOCTORS */}
        <Animated.View
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Pressable
              onPress={() => router.push("/(tabs)/doctors" as never)}
              style={styles.viewAllBtn}
              accessibilityRole="button"
              accessibilityLabel="عرض كل الأطباء"
            >
              <ThemedText
                type="small"
                style={{ color: BRAND_BLUE_DEEP, fontWeight: "600" }}
              >
                عرض الكل
              </ThemedText>
              <Feather name="chevron-left" size={14} color={BRAND_BLUE_DEEP} />
            </Pressable>
            <ThemedText
              type="h4"
              style={[styles.sectionTitle, { color: textPrimary }]}
            >
              أطباء مميزون
            </ThemedText>
          </View>

          <View style={styles.doctorsRow}>
            {featuredDoctors.map((doc, i) => (
              <Animated.View
                key={doc.id}
                style={styles.doctorCardWrap}
              >
                <Pressable
                  onPress={() => router.push(`/doctor/${doc.id}` as never)}
                  style={[
                    styles.doctorCard,
                    { backgroundColor: cardBg, borderColor: subtleBorder },
                  ]}
                >
                  <Image
                    source={
                      doctorImages[doc.id] ??
                      require("@/assets/images/doctor-ahmed.png")
                    }
                    contentFit="cover"
                    priority="high"
                    cachePolicy="memory-disk"
                    style={styles.doctorPhoto}
                  />
                  <ThemedText
                    type="small"
                    style={[styles.doctorName, { color: textPrimary }]}
                    numberOfLines={1}
                  >
                    {doc.nameAr}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: textSecondary,
                      textAlign: "center",
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {doc.specialtyAr}
                  </ThemedText>
                  <View style={styles.ratingRow}>
                    <ThemedText
                      type="caption"
                      style={{
                        color: textPrimary,
                        fontWeight: "700",
                        marginRight: 3,
                      }}
                    >
                      {doc.rating}
                    </ThemedText>
                    <Ionicons name="star" size={11} color="#FFB800" />
                  </View>
                  <Pressable
                    onPress={() => router.push(`/doctor/${doc.id}` as never)}
                    style={[
                      styles.bookBtn,
                      { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.08) },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`احجز موعد مع ${doc.nameAr}`}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: BRAND_BLUE_DEEP,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      احجز الآن
                    </ThemedText>
                    <Feather
                      name="chevron-left"
                      size={11}
                      color={BRAND_BLUE_DEEP}
                    />
                  </Pressable>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* HEALTH STATUS CARD */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.section}>
          <View
            style={[
              styles.healthCard,
              { backgroundColor: cardBg, borderColor: subtleBorder },
            ]}
          >
            {/* Header */}
            <View style={[styles.healthHeader, { justifyContent: "space-between" }]}>
              <Pressable
                onPress={() => setPermModalVisible(true)}
                style={[styles.connectBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1) }]}
              >
                <Feather name="link" size={11} color={BRAND_BLUE_DEEP} />
                <ThemedText type="caption" style={{ color: BRAND_BLUE_DEEP, fontSize: 11, fontWeight: "600" }}>
                  {healthData?.isConnected ? "مرتبط" : "ربط الساعة"}
                </ThemedText>
              </Pressable>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                <Animated.View style={heartPulseStyle}>
                  <Feather name="heart" size={15} color={BRAND_BLUE_DEEP} />
                </Animated.View>
                <ThemedText
                  type="small"
                  style={{ color: textPrimary, fontWeight: "800", marginRight: 6 }}
                >
                  حالتك اليوم
                </ThemedText>
                {/* Health Score Badge */}
                {healthData && !healthLoading && (
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: getScoreBadgeBg(healthData.score) },
                    ]}
                  >
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700", fontFamily: "Tajawal_700Bold" }}>
                      {healthData.score}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* شارة البيانات التجريبية */}
            {healthData?.source === "mock" && !healthLoading && (
              <View style={styles.mockBadge}>
                <Feather name="info" size={10} color={addAlpha(textSecondary, 0.8)} />
                <Text style={{ color: addAlpha(textSecondary, 0.8), fontSize: 10, marginRight: 4, fontFamily: "Tajawal_400Regular" }}>
                  بيانات تجريبية للمعاينة
                </Text>
              </View>
            )}

            {/* Body */}
            {healthLoading && !healthData ? (
              /* Skeleton Loading */
              <View style={styles.healthBody}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.healthMetric, { backgroundColor: metricBg }]}>
                    <View style={[styles.skeletonLine, { width: 24, height: 14, marginBottom: 6, backgroundColor: addAlpha(textSecondary, 0.25) }]} />
                    <View style={[styles.skeletonLine, { width: 40, height: 10, marginBottom: 4, backgroundColor: addAlpha(textSecondary, 0.15) }]} />
                    <View style={[styles.skeletonLine, { width: 32, height: 10, backgroundColor: addAlpha(textSecondary, 0.1) }]} />
                  </View>
                ))}
                <View style={styles.healthShield} />
              </View>
            ) : healthError && !healthData ? (
              /* Error + Retry */
              <View style={styles.healthEmptyState}>
                <Feather name="wifi-off" size={26} color={addAlpha(textSecondary, 0.6)} />
                <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8, fontFamily: "Tajawal_400Regular", textAlign: "center" }}>
                  تعذّر تحميل البيانات الصحية
                </Text>
                <Pressable
                  onPress={retryHealth}
                  style={[styles.retryBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1) }]}
                >
                  <Feather name="refresh-cw" size={12} color={BRAND_BLUE_DEEP} />
                  <Text style={{ color: BRAND_BLUE_DEEP, fontSize: 12, fontWeight: "600", marginRight: 5, fontFamily: "Tajawal_500Medium" }}>
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </View>
            ) : healthData?.source === "none" ? (
              /* غير مربوط */
              <View style={styles.healthEmptyState}>
                <Feather name="link-2" size={26} color={addAlpha(textSecondary, 0.6)} />
                <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8, fontFamily: "Tajawal_400Regular", textAlign: "center" }}>
                  اربط ساعتك أو تطبيق الصحة
                </Text>
                <Pressable
                  onPress={() => setPermModalVisible(true)}
                  style={[styles.retryBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1) }]}
                >
                  <Feather name="link" size={12} color={BRAND_BLUE_DEEP} />
                  <Text style={{ color: BRAND_BLUE_DEEP, fontSize: 12, fontWeight: "600", marginRight: 5, fontFamily: "Tajawal_500Medium" }}>
                    ربط الآن
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.healthBody}>
                {/* النشاط */}
                <View style={[styles.healthMetric, { backgroundColor: metricBg }]}>
                  <Feather name="activity" size={14} color={textSecondary} />
                  <ThemedText type="caption" style={{ color: textSecondary, marginTop: 4 }}>
                    النشاط
                  </ThemedText>
                  <ThemedText type="small" style={{ color: textPrimary, fontWeight: "700", marginTop: 2 }}>
                    {getActivityLabel(healthData?.activity.level ?? "moderate")}
                  </ThemedText>
                  <View style={[styles.healthBar, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1) }]}>
                    <Animated.View
                      style={[styles.healthBarFill, { backgroundColor: BRAND_BLUE_DEEP }, barFillStyle]}
                    />
                  </View>
                </View>

                {/* ضغط الدم */}
                <View style={[styles.healthMetric, { backgroundColor: metricBg }]}>
                  <Feather name="droplet" size={14} color={textSecondary} />
                  <ThemedText type="caption" style={{ color: textSecondary, marginTop: 4 }}>
                    ضغط الدم
                  </ThemedText>
                  <ThemedText type="small" style={{ color: textPrimary, fontWeight: "700", marginTop: 2 }}>
                    {healthData?.bloodPressure.systolic != null
                      ? `${healthData.bloodPressure.systolic}/${healthData.bloodPressure.diastolic}`
                      : "غير متوفر"}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: getStatusColor(healthData?.bloodPressure.status ?? "unavailable"),
                      marginTop: 2,
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {healthData?.bloodPressure.status === "normal"
                      ? "طبيعي"
                      : healthData?.bloodPressure.status === "high"
                      ? "مرتفع"
                      : healthData?.bloodPressure.status === "low"
                      ? "منخفض"
                      : "—"}
                  </ThemedText>
                </View>

                {/* نبض القلب */}
                <View style={[styles.healthMetric, { backgroundColor: metricBg }]}>
                  <Feather name="heart" size={14} color={textSecondary} />
                  <ThemedText type="caption" style={{ color: textSecondary, marginTop: 4 }}>
                    نبض القلب
                  </ThemedText>
                  <ThemedText type="small" style={{ color: textPrimary, fontWeight: "700", marginTop: 2 }}>
                    {healthData?.heartRate.value != null
                      ? String(healthData.heartRate.value)
                      : "—"}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: getStatusColor(healthData?.heartRate.status ?? "unavailable"),
                      marginTop: 2,
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {healthData?.heartRate.status === "normal"
                      ? "طبيعي"
                      : healthData?.heartRate.status === "high"
                      ? "مرتفع"
                      : healthData?.heartRate.status === "low"
                      ? "منخفض"
                      : "—"}
                  </ThemedText>
                </View>

                <Image
                  source={require("@/assets/images/health-shield.png")}
                  style={styles.healthShield}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          </View>
        </Animated.View>

        {/* TIP OF THE DAY */}
        <Animated.View
          style={styles.section}
        >
          <View
            style={[
              styles.tipCard,
              { backgroundColor: cardBg, borderColor: subtleBorder },
            ]}
          >
            <View style={styles.tipTextCol}>
              <View style={styles.tipHeader}>
                <ThemedText
                  type="small"
                  style={{
                    color: textPrimary,
                    fontWeight: "800",
                    marginLeft: 6,
                  }}
                >
                  نصيحة اليوم
                </ThemedText>
                <Feather name="zap" size={14} color="#FFB800" />
              </View>
              <View style={{ overflow: "hidden", marginTop: 6 }}>
                <Animated.View style={tipAnimatedStyle}>
                  <Text
                    style={{
                      color: textSecondary,
                      textAlign: "right",
                      lineHeight: 18,
                      fontSize: 12,
                      fontFamily: "Tajawal_400Regular",
                    }}
                  >
                    {visibleTip}
                  </Text>
                </Animated.View>
              </View>
            </View>
            <View style={styles.tipImageWrap}>
              <Image
                source={require("@/assets/images/water-glass.png")}
                style={styles.tipImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* EMERGENCY BUTTON */}
      <Pressable
        onPress={() => setEmergencyVisible(true)}
        style={[
          styles.fab,
          {
            backgroundColor: "#DC2626",
            bottom: tabBarHeight + 16,
            borderColor: "#B91C1C",
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="طلب سيارة إسعاف"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="ambulance" size={18} color="#FFFFFF" />
        <ThemedText
          type="caption"
          style={{
            color: "#FFFFFF",
            fontWeight: "700",
            marginRight: 6,
            fontSize: 12,
          }}
        >
          الطوارئ
        </ThemedText>
      </Pressable>

      <EmergencyModal
        visible={emergencyVisible}
        onClose={() => setEmergencyVisible(false)}
      />
      <HealthPermissionModal
        visible={permModalVisible}
        onClose={() => setPermModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },

  bellWrap: {
    width: 46,
    height: 46,
    position: "relative",
  },
  bellBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  bellBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },

  greetingArea: {
    flex: 1,
    alignItems: "flex-end",
  },
  greetingTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  greetingHello: {
    fontWeight: "800",
    fontSize: 20,
  },
  wave: {
    fontSize: 22,
  },
  greetingSubRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 3,
  },

  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },

  searchSection: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  cameraBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchBar: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    padding: 0,
    height: "100%",
  },

  bannerWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  banner: {
    borderRadius: 22,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 175,
    overflow: "hidden",
  },
  crossDecor1: {
    position: "absolute",
    top: 18,
    left: "32%",
  },
  crossDecor2: {
    position: "absolute",
    bottom: 22,
    left: "28%",
  },
  crossDecor3: {
    position: "absolute",
    top: "50%",
    left: "20%",
  },
  bannerTextCol: {
    flex: 1.2,
    alignItems: "flex-end",
    paddingRight: 4,
  },
  bannerTitle: {
    color: "#FFF",
    fontWeight: "800",
    textAlign: "right",
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.92)",
    textAlign: "right",
    marginBottom: 14,
    fontSize: 12,
  },
  bannerCta: {
    backgroundColor: "#FFF",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerCtaText: {
    color: BRAND_BLUE_DEEP,
    fontWeight: "700",
    fontSize: 13,
  },
  bannerImageCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerImage: {
    width: 130,
    height: 150,
  },

  quickRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickItemWrap: {
    flex: 1,
  },
  quickItem: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: 18,
    gap: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 11,
  },

  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  viewAllBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
  },

  doctorsRow: {
    flexDirection: "row-reverse",
    gap: Spacing.sm,
  },
  doctorCardWrap: {
    flex: 1,
  },
  doctorCard: {
    borderRadius: 18,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  doctorPhoto: {
    width: "100%",
    height: 90,
    borderRadius: 12,
    marginBottom: 8,
  },
  doctorName: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 12,
  },
  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 4,
  },
  bookBtn: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  healthCard: {
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  healthBody: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: 8,
  },
  healthShield: {
    width: 70,
    height: 88,
    alignSelf: "center",
  },
  healthMetric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  healthBar: {
    marginTop: 6,
    width: "75%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  connectBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  skeletonLine: {
    borderRadius: 6,
  },
  scoreBadge: {
    minWidth: 26,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  mockBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 8,
    gap: 3,
    opacity: 0.7,
  },
  healthEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 0,
  },
  retryBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  tipCard: {
    flexDirection: "row-reverse",
    borderRadius: 20,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tipImageWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  tipImage: {
    width: 60,
    height: 60,
  },
  tipTextCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  tipHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  fab: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
});
