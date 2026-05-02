import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import EmergencyModal from "@/components/EmergencyModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { doctors as mockDoctors } from "@/data/mockData";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const BRAND_BLUE = "#1F40C8";
const BRAND_CYAN = "#5EDFFF";
const BRAND_PURPLE = "#8B7CF6";

const doctorImages: Record<string, ReturnType<typeof require>> = {
  "1": require("@/assets/images/doctor-ahmed.png"),
  "2": require("@/assets/images/doctor-sara.png"),
  "5": require("@/assets/images/doctor-ali.png"),
};

const featuredDoctorIds = ["2", "1", "5"];

const quickServices = [
  {
    id: "prescription",
    labelAr: "تصوير وصفة",
    icon: "camera" as const,
    iconLib: "feather" as const,
    color: BRAND_CYAN,
    route: "/search" as const,
  },
  {
    id: "pharmacy",
    labelAr: "أقرب صيدلية",
    icon: "map-pin" as const,
    iconLib: "feather" as const,
    color: BRAND_BLUE,
    route: "/(tabs)/pharmacies" as const,
  },
  {
    id: "medicine",
    labelAr: "البحث عن دواء",
    icon: "pill" as const,
    iconLib: "mci" as const,
    color: BRAND_PURPLE,
    route: "/search" as const,
  },
  {
    id: "doctor",
    labelAr: "حجز طبيب",
    icon: "stethoscope" as const,
    iconLib: "mci" as const,
    color: BRAND_CYAN,
    route: "/(tabs)/doctors" as const,
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const firstName = user?.fullName?.split(" ")[0] ?? "صديقي";
  const cardBg = isDark ? theme.card : "#FFFFFF";
  const screenBg = isDark ? theme.backgroundRoot : "#F5F7FB";
  const subtleBorder = isDark ? addAlpha("#FFFFFF", 0.06) : addAlpha("#0A0F1A", 0.04);

  const featuredDoctors = featuredDoctorIds
    .map((id) => mockDoctors.find((d) => d.id === id))
    .filter(Boolean) as typeof mockDoctors;

  const renderQuickIcon = (svc: (typeof quickServices)[number]) => {
    if (svc.iconLib === "mci") {
      return (
        <MaterialCommunityIcons
          name={svc.icon as "pill" | "stethoscope"}
          size={26}
          color={svc.color}
        />
      );
    }
    return <Feather name={svc.icon as "camera" | "map-pin"} size={24} color={svc.color} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 32 }}
      >
        {/* HEADER */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.header,
            { paddingTop: Platform.OS === "web" ? 24 : insets.top + 8 },
          ]}
        >
          <Pressable
            onPress={() => router.push("/notifications")}
            style={[styles.bellBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}
          >
            <Feather name="bell" size={20} color={theme.text} />
            <View style={styles.bellBadge}>
              <ThemedText
                type="caption"
                style={{ color: "#FFF", fontSize: 10, fontWeight: "800", lineHeight: 12 }}
              >
                3
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.greetingArea}>
            <View style={styles.greetingTopRow}>
              <ThemedText type="h3" style={[styles.greetingHello, { color: theme.text }]}>
                أهلاً {firstName}
              </ThemedText>
              <ThemedText type="h3" style={styles.wave}>
                👋
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/doctors" as const)}
              style={styles.greetingSubRow}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                كيف صحتك اليوم؟
              </ThemedText>
              <Feather
                name="chevron-left"
                size={14}
                color={theme.textSecondary}
                style={{ marginRight: 2 }}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/bookings")}
            style={styles.avatarWrap}
          >
            <LinearGradient
              colors={[BRAND_BLUE, BRAND_CYAN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={[styles.avatarInner, { backgroundColor: cardBg }]}>
                <ThemedText
                  type="h3"
                  style={{ color: BRAND_BLUE, fontWeight: "800" }}
                >
                  {firstName.charAt(0)}
                </ThemedText>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* SEARCH BAR */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(400)}
          style={styles.searchSection}
        >
          <Pressable
            style={[styles.cameraBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}
            onPress={() => router.push("/search")}
          >
            <Feather name="camera" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            style={[
              styles.searchBar,
              { backgroundColor: cardBg, borderColor: subtleBorder },
            ]}
            onPress={() => router.push("/search")}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="ابحث عن طبيب، دواء، أو صيدلية..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              onFocus={() => router.push("/search")}
              showSoftInputOnFocus={false}
            />
          </Pressable>
        </Animated.View>

        {/* HERO BANNER */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(450)}
          style={styles.bannerWrap}
        >
          <LinearGradient
            colors={[BRAND_BLUE, "#3A6BE5", BRAND_CYAN]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerTextCol}>
              <ThemedText type="h2" style={styles.bannerTitle}>
                احجز طبيبك خلال{"\n"}ثواني
              </ThemedText>
              <ThemedText type="small" style={styles.bannerSubtitle}>
                أو ابحث عن دواء قريب منك
              </ThemedText>
              <Pressable
                onPress={() => router.push("/(tabs)/doctors" as const)}
                style={styles.bannerCta}
              >
                <Feather name="chevron-left" size={16} color={BRAND_BLUE} />
                <ThemedText type="small" style={styles.bannerCtaText}>
                  ابدأ الآن
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.bannerImageCol}>
              <Image
                source={require("@/assets/images/banner-phone.png")}
                style={styles.bannerImage}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* QUICK SERVICES */}
        <Animated.View
          entering={FadeInUp.delay(220).duration(400)}
          style={styles.quickRow}
        >
          {quickServices.map((svc, i) => (
            <Animated.View
              key={svc.id}
              entering={FadeInUp.delay(260 + i * 60).duration(350)}
              style={{ flex: 1 }}
            >
              <Pressable
                onPress={() => router.push(svc.route as never)}
                style={[
                  styles.quickItem,
                  { backgroundColor: cardBg, borderColor: subtleBorder },
                ]}
              >
                <View
                  style={[
                    styles.quickIconBg,
                    { backgroundColor: addAlpha(svc.color, 0.12) },
                  ]}
                >
                  {renderQuickIcon(svc)}
                </View>
                <ThemedText
                  type="caption"
                  style={[styles.quickLabel, { color: theme.text }]}
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
          entering={FadeInUp.delay(380).duration(400)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Pressable
              onPress={() => router.push("/(tabs)/doctors" as const)}
              style={styles.viewAllBtn}
            >
              <Feather name="chevron-left" size={14} color={BRAND_BLUE} />
              <ThemedText type="small" style={{ color: BRAND_BLUE, fontWeight: "600" }}>
                عرض الكل
              </ThemedText>
            </Pressable>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              أطباء مميزون
            </ThemedText>
          </View>

          <View style={styles.doctorsRow}>
            {featuredDoctors.map((doc, i) => (
              <Animated.View
                key={doc.id}
                entering={FadeInUp.delay(440 + i * 80).duration(400)}
                style={{ flex: 1 }}
              >
                <Pressable
                  onPress={() => router.push(`/doctor/${doc.id}` as never)}
                  style={[
                    styles.doctorCard,
                    { backgroundColor: cardBg, borderColor: subtleBorder },
                  ]}
                >
                  <Image
                    source={doctorImages[doc.id] ?? require("@/assets/images/doctor-ahmed.png")}
                    style={styles.doctorPhoto}
                  />
                  <ThemedText
                    type="small"
                    style={[styles.doctorName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {doc.nameAr}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, textAlign: "center" }}
                    numberOfLines={1}
                  >
                    {doc.specialtyAr}
                  </ThemedText>
                  <View style={styles.ratingRow}>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.text, fontWeight: "700", marginRight: 3 }}
                    >
                      {doc.rating}
                    </ThemedText>
                    <Ionicons name="star" size={11} color="#FFB800" />
                  </View>
                  <Pressable
                    onPress={() => router.push(`/doctor/${doc.id}` as never)}
                    style={[styles.bookBtn, { borderColor: addAlpha(BRAND_BLUE, 0.3) }]}
                  >
                    <Feather name="chevron-left" size={12} color={BRAND_BLUE} />
                    <ThemedText
                      type="caption"
                      style={{ color: BRAND_BLUE, fontWeight: "600" }}
                    >
                      احجز الآن
                    </ThemedText>
                  </Pressable>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* HEALTH STATUS CARD */}
        <Animated.View
          entering={FadeInUp.delay(560).duration(400)}
          style={styles.section}
        >
          <View
            style={[
              styles.healthCard,
              { backgroundColor: cardBg, borderColor: subtleBorder },
            ]}
          >
            <View style={styles.healthHeader}>
              <Feather name="heart" size={16} color={BRAND_BLUE} />
              <ThemedText
                type="small"
                style={{ color: theme.text, fontWeight: "700", marginRight: 6 }}
              >
                حالتك اليوم
              </ThemedText>
            </View>

            <View style={styles.healthBody}>
              <View style={styles.healthShieldCol}>
                <Image
                  source={require("@/assets/images/health-shield.png")}
                  style={styles.healthShield}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.healthMetric}>
                <Feather name="droplet" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  النشاط
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.text, fontWeight: "700", marginTop: 2 }}
                >
                  متوسط
                </ThemedText>
                <View style={styles.healthBar}>
                  <View
                    style={[
                      styles.healthBarFill,
                      { backgroundColor: BRAND_BLUE, width: "55%" },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.healthMetric}>
                <Feather name="droplet" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  ضغط الدم
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.text, fontWeight: "700", marginTop: 2 }}
                >
                  120/80
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: "#22C55E", marginTop: 2, fontWeight: "600" }}
                >
                  طبيعي
                </ThemedText>
              </View>

              <View style={styles.healthMetric}>
                <Feather name="heart" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  نبض القلب
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.text, fontWeight: "700", marginTop: 2 }}
                >
                  72
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: "#22C55E", marginTop: 2, fontWeight: "600" }}
                >
                  طبيعي
                </ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* TIP OF THE DAY */}
        <Animated.View
          entering={FadeInUp.delay(660).duration(400)}
          style={styles.section}
        >
          <View
            style={[
              styles.tipCard,
              { backgroundColor: cardBg, borderColor: subtleBorder },
            ]}
          >
            <View style={styles.tipIconWrap}>
              <MaterialCommunityIcons name="cup-water" size={32} color={BRAND_CYAN} />
            </View>
            <View style={styles.tipTextCol}>
              <View style={styles.tipHeader}>
                <Feather name="zap" size={14} color="#FFB800" />
                <ThemedText
                  type="small"
                  style={{ color: theme.text, fontWeight: "700", marginRight: 6 }}
                >
                  نصيحة اليوم
                </ThemedText>
              </View>
              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  textAlign: "right",
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                شرب الماء بانتظام يساعد على تحسين نشاطك وصحتك العامة
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* FLOATING CONSULT BUTTON */}
      <Pressable
        onPress={() => setEmergencyVisible(true)}
        style={[
          styles.fab,
          {
            backgroundColor: BRAND_BLUE,
            bottom: tabBarHeight + 16,
          },
        ]}
      >
        <Feather name="message-circle" size={18} color="#FFF" />
        <ThemedText
          type="caption"
          style={{ color: "#FFF", fontWeight: "700", marginRight: 6 }}
        >
          استشارة
        </ThemedText>
      </Pressable>

      <EmergencyModal
        visible={emergencyVisible}
        onClose={() => setEmergencyVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  greetingArea: {
    flex: 1,
    alignItems: "flex-end",
    marginHorizontal: Spacing.md,
  },
  greetingTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  greetingHello: {
    fontWeight: "800",
  },
  wave: {
    fontSize: 22,
  },
  greetingSubRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 2,
  },
  avatarWrap: {},
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 24,
    padding: Spacing.xl,
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 170,
    overflow: "hidden",
  },
  bannerTextCol: {
    flex: 1.4,
    alignItems: "flex-end",
  },
  bannerTitle: {
    color: "#FFF",
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 28,
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
    marginBottom: 14,
  },
  bannerCta: {
    backgroundColor: "#FFF",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  bannerCtaText: {
    color: BRAND_BLUE,
    fontWeight: "700",
  },
  bannerImageCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerImage: {
    width: 120,
    height: 140,
  },

  quickRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickItem: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: 18,
    gap: 8,
    borderWidth: 1,
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
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "800",
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
  doctorCard: {
    borderRadius: 18,
    padding: Spacing.sm,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  doctorPhoto: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 6,
  },
  doctorName: {
    fontWeight: "700",
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 2,
  },
  bookBtn: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  healthCard: {
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  healthHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  healthBody: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  healthShieldCol: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  healthShield: {
    width: 60,
    height: 60,
  },
  healthMetric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  healthBar: {
    marginTop: 6,
    width: "80%",
    height: 4,
    borderRadius: 2,
    backgroundColor: addAlpha(BRAND_BLUE, 0.12),
    overflow: "hidden",
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 2,
  },

  tipCard: {
    flexDirection: "row-reverse",
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    gap: Spacing.md,
  },
  tipIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: addAlpha(BRAND_CYAN, 0.12),
    alignItems: "center",
    justifyContent: "center",
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
    left: Spacing.xl,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
