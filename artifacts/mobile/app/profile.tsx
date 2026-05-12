import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Switch,
  Modal,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import InitialsAvatar from "@/components/InitialsAvatar";

const isWeb = Platform.OS === "web";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Stack, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const BRAND_BLUE_DEEP = "#1F40C8";
const BRAND_BLUE = "#2A4FCC";
const BANNER_CYAN = "#5CC4E6";

type IconLib = "feather" | "ion" | "mci";

interface MenuRow {
  id: string;
  label: string;
  icon: string;
  iconLib?: IconLib;
  iconColor?: string;
  bg?: string;
  trailingText?: string;
  onPress?: () => void;
  destructive?: boolean;
  hideChevron?: boolean;
  rightElement?: React.ReactNode;
}

interface MenuSection {
  id: string;
  title: string;
  rows: MenuRow[];
}

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { user, logout } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const screenBg = isDark ? "#0A0F1A" : "#F5F7FB";
  const cardBg = isDark ? "#161B22" : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#EFEFEF";
  const textPrimary = isDark ? "#F0F6FC" : "#0F172A";
  const textSecondary = isDark ? "#8B95A5" : "#6B7280";

  const performLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm("هل أنت متأكد من تسجيل الخروج من حسابك؟");
      if (ok) void performLogout();
      return;
    }
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد من تسجيل الخروج من حسابك؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: () => void performLogout(),
        },
      ],
    );
  };

  const cycleTheme = () => {
    const next =
      themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";
    setThemeMode(next);
  };

  const themeLabel =
    themeMode === "system" ? "تلقائي" : themeMode === "light" ? "فاتح" : "داكن";

  const formattedPhone = (user?.phoneNumber ?? "")
    .replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3");

  const sections: MenuSection[] = [
    {
      id: "account",
      title: "الحساب",
      rows: [
        {
          id: "edit-profile",
          label: "تعديل المعلومات الشخصية",
          icon: "user",
          iconColor: "#3FC8E5",
          bg: "#E8F8FC",
          onPress: () => router.push("/edit-profile"),
        },
      ],
    },
    {
      id: "activity",
      title: "نشاطي",
      rows: [
        {
          id: "bookings",
          label: "حجوزاتي",
          icon: "calendar",
          iconColor: "#1F40C8",
          bg: "#E8EDFC",
          onPress: () => router.push("/bookings"),
        },
        {
          id: "orders",
          label: "طلباتي",
          icon: "package",
          iconColor: "#F97316",
          bg: "#FFF1E5",
          onPress: () => router.push("/orders"),
        },
        {
          id: "my-medications",
          label: "أدويتي الدائمة",
          icon: "activity",
          iconColor: "#10B981",
          bg: "#D1FAE5",
          onPress: () => router.push("/my-medications"),
        },
        {
          id: "medication-history",
          label: "سجل طلبات الدواء",
          icon: "file-text",
          iconColor: "#8B5CF6",
          bg: "#EDE9FE",
          onPress: () => router.push("/medication-history"),
        },
        {
          id: "notifications-list",
          label: "الإشعارات",
          icon: "bell",
          iconColor: "#A78BFA",
          bg: "#F0EBFC",
          trailingText: "3",
          onPress: () => router.push("/notifications"),
        },
      ],
    },
    {
      id: "app",
      title: "إعدادات التطبيق",
      rows: [
        {
          id: "theme",
          label: "المظهر",
          icon: "moon",
          iconColor: "#7C3AED",
          bg: "#F1ECFD",
          trailingText: themeLabel,
          onPress: cycleTheme,
          hideChevron: true,
        },
        {
          id: "notif-toggle",
          label: "تفعيل الإشعارات",
          icon: "bell",
          iconColor: "#F59E0B",
          bg: "#FEF3D5",
          hideChevron: true,
          rightElement: (
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: "#D1D5DB", true: addAlpha(BRAND_BLUE, 0.45) }}
              thumbColor={notifEnabled ? BRAND_BLUE : "#F4F6FA"}
            />
          ),
        },
      ],
    },
    {
      id: "support",
      title: "الدعم والمساعدة",
      rows: [
        {
          id: "help",
          label: "مركز المساعدة",
          icon: "help-circle",
          iconColor: "#0EA5E9",
          bg: "#E5F4FE",
          onPress: () => Alert.alert("مركز المساعدة", "ستجد هنا الإجابات على أسئلتك الشائعة قريباً"),
        },
        {
          id: "contact",
          label: "تواصل معنا",
          icon: "mail",
          iconColor: "#1F40C8",
          bg: "#E8EDFC",
          onPress: () => Linking.openURL("mailto:support@triaq.app"),
        },
        {
          id: "rate",
          label: "قيّم التطبيق",
          icon: "star",
          iconColor: "#F59E0B",
          bg: "#FEF3D5",
          onPress: () => Alert.alert("شكراً لك", "سيتم فتح المتجر لتقييم التطبيق قريباً"),
        },
      ],
    },
    {
      id: "legal",
      title: "حول التطبيق",
      rows: [
        {
          id: "about",
          label: "حول ترياق",
          icon: "info",
          iconColor: "#3FC8E5",
          bg: "#E8F8FC",
          onPress: () => setAboutVisible(true),
        },
        {
          id: "terms",
          label: "اتفاقية المستخدم",
          icon: "file-text",
          iconColor: "#6B7280",
          bg: "#F3F4F6",
          onPress: () => setTermsVisible(true),
        },
        {
          id: "privacy",
          label: "سياسة الخصوصية",
          icon: "lock",
          iconColor: "#14B8A6",
          bg: "#E6FAF6",
          onPress: () => setPrivacyVisible(true),
        },
        {
          id: "version",
          label: "إصدار التطبيق",
          icon: "smartphone",
          iconColor: "#9CA3AF",
          bg: "#F3F4F6",
          trailingText: "1.0.0",
          hideChevron: true,
        },
      ],
    },
  ];

  const renderIcon = (row: MenuRow) => {
    const color = row.iconColor ?? textPrimary;
    const lib = row.iconLib ?? "feather";
    if (lib === "ion") return <Ionicons name={row.icon as never} size={18} color={color} />;
    if (lib === "mci") return <MaterialCommunityIcons name={row.icon as never} size={18} color={color} />;
    return <Feather name={row.icon as never} size={18} color={color} />;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: screenBg }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.closeBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}
              hitSlop={10}
              accessibilityLabel="إغلاق"
              accessibilityRole="button"
            >
              <Feather name="x" size={20} color={textPrimary} />
            </Pressable>
            <ThemedText
              type="h3"
              style={[styles.topTitle, { color: textPrimary }]}
            >
              حسابي
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile header card */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <LinearGradient
              colors={[BRAND_BLUE_DEEP, BRAND_BLUE, BANNER_CYAN]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
              <View style={styles.profileTopRow}>
                <View style={styles.avatarRing}>
                  {user?.avatarUri ? (
                    <Image
                      source={{ uri: user.avatarUri }}
                      style={styles.profileAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <InitialsAvatar name={user?.fullName ?? ""} size={70} />
                  )}
                  <View style={styles.verifiedDot}>
                    <Feather name="check" size={10} color="#FFF" />
                  </View>
                </View>
                <View style={styles.profileInfo}>
                  <ThemedText type="h2" style={styles.profileName}>
                    {user?.fullName || "المستخدم"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.profilePhone}>
                    {formattedPhone || "—"}
                  </ThemedText>
                  <View style={styles.roleBadge}>
                    <Feather name="user" size={10} color="#FFF" />
                    <ThemedText type="caption" style={styles.roleBadgeText}>
                      {user?.role === "doctor"
                        ? "طبيب"
                        : user?.role === "pharmacist"
                          ? "صيدلي"
                          : "مستخدم"}
                    </ThemedText>
                  </View>
                </View>
              </View>

            </LinearGradient>
          </Animated.View>

          {/* Sections */}
          {sections.map((section, sIdx) => (
            <Animated.View
              key={section.id}
              entering={FadeInUp.delay(120 + sIdx * 60).duration(380)}
              style={styles.sectionWrap}
            >
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: textSecondary }]}
              >
                {section.title}
              </ThemedText>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: cardBg, borderColor: subtleBorder },
                ]}
              >
                {section.rows.map((row, rIdx) => (
                  <Pressable
                    key={row.id}
                    onPress={row.onPress}
                    disabled={!row.onPress && !row.rightElement}
                    style={({ pressed }) => [
                      styles.row,
                      rIdx > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: subtleBorder,
                      },
                      pressed && row.onPress && { opacity: 0.6 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: row.bg ?? addAlpha(BRAND_BLUE, 0.1) }]}>
                      {renderIcon(row)}
                    </View>
                    <View style={styles.rowMain}>
                      <ThemedText
                        type="body"
                        style={[
                          styles.rowLabel,
                          { color: row.destructive ? "#EF4444" : textPrimary },
                        ]}
                      >
                        {row.label}
                      </ThemedText>
                    </View>
                    {row.rightElement ? (
                      row.rightElement
                    ) : (
                      <View style={styles.rowRight}>
                        {row.trailingText ? (
                          <ThemedText
                            type="small"
                            style={{ color: textSecondary, marginLeft: 6 }}
                          >
                            {row.trailingText}
                          </ThemedText>
                        ) : null}
                        {!row.hideChevron && row.onPress ? (
                          <Feather
                            name="chevron-left"
                            size={16}
                            color={textSecondary}
                          />
                        ) : null}
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ))}

          {/* Logout */}
          <Animated.View
            entering={FadeInUp.delay(420).duration(380)}
            style={styles.logoutWrap}
          >
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutBtn,
                { backgroundColor: cardBg, borderColor: "#FCA5A5" },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الخروج"
            >
              <Feather name="log-out" size={18} color="#EF4444" />
              <ThemedText
                type="body"
                style={{ color: "#EF4444", fontWeight: "700", marginRight: 8 }}
              >
                تسجيل الخروج
              </ThemedText>
            </Pressable>
          </Animated.View>

          <ThemedText
            type="caption"
            style={[styles.copyright, { color: textSecondary }]}
          >
            ترياق © 2026 — جميع الحقوق محفوظة
          </ThemedText>
        </ScrollView>

        <InfoSheet
          visible={aboutVisible}
          onClose={() => setAboutVisible(false)}
          title="حول ترياق"
          body={
            "ترياق هو رفيقك الصحي المتكامل في العراق. نوفّر لك حجز الأطباء، البحث عن الأدوية، والتواصل مع أقرب الصيدليات بضغطة واحدة.\n\nمهمتنا أن تكون الرعاية الصحية في متناول الجميع، بسهولة وسرعة وأمان."
          }
        />
        <InfoSheet
          visible={termsVisible}
          onClose={() => setTermsVisible(false)}
          title="اتفاقية المستخدم"
          body={
            "باستخدامك لتطبيق ترياق فإنك توافق على:\n\n• استخدام التطبيق للأغراض المشروعة فقط.\n• تقديم معلومات صحيحة ودقيقة عند التسجيل.\n• الالتزام بمواعيد الحجوزات أو إلغائها مسبقاً.\n• عدم استخدام التطبيق لأي نشاط قد يضر بالآخرين.\n\nيحتفظ التطبيق بحق تعليق أو إنهاء الحساب في حال مخالفة الشروط."
          }
        />
        <InfoSheet
          visible={privacyVisible}
          onClose={() => setPrivacyVisible(false)}
          title="سياسة الخصوصية"
          body={
            "نحن في ترياق نحترم خصوصيتك:\n\n• بياناتك الشخصية مشفّرة ومحمية.\n• لن نشارك معلوماتك مع أي طرف ثالث دون إذنك.\n• الموقع يُستخدم فقط لعرض الخدمات القريبة منك.\n• يمكنك حذف حسابك وبياناتك في أي وقت.\n\nللمزيد تواصل معنا عبر support@triaq.app"
          }
        />
      </SafeAreaView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <ThemedText type="h3" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function InfoSheet({
  visible,
  onClose,
  title,
  body,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
}) {
  const { isDark } = useTheme();
  const cardBg = isDark ? "#161B22" : "#FFFFFF";
  const text = isDark ? "#F0F6FC" : "#0F172A";
  const textSec = isDark ? "#8B95A5" : "#6B7280";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalSheet, { backgroundColor: cardBg }]}
        >
          <View style={styles.modalGrabber} />
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={text} />
            </Pressable>
            <ThemedText type="h3" style={{ color: text }}>
              {title}
            </ThemedText>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <ThemedText
              type="body"
              style={{
                color: textSec,
                textAlign: "right",
                lineHeight: 24,
                paddingHorizontal: Spacing.xl,
              }}
            >
              {body}
            </ThemedText>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: isWeb ? 60 : Spacing.md,
    paddingBottom: Spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontWeight: "800",
    fontSize: 18,
  },
  profileCard: {
    marginHorizontal: Spacing.xl,
    borderRadius: 22,
    padding: Spacing.xl,
    overflow: "hidden",
  },
  profileTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.lg,
  },
  avatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  verifiedDot: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  profileName: {
    color: "#FFF",
    fontWeight: "800",
    textAlign: "right",
    fontSize: 20,
  },
  profilePhone: {
    color: "rgba(255,255,255,0.92)",
    textAlign: "right",
    marginTop: 2,
    fontSize: 13,
  },
  roleBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  roleBadgeText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 11,
  },
  statsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: Spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 18,
  },
  statLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  sectionWrap: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    textAlign: "right",
    marginBottom: Spacing.sm,
    marginRight: Spacing.xs,
    fontWeight: "700",
    fontSize: 12,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: {
    flex: 1,
    alignItems: "flex-end",
  },
  rowLabel: {
    fontWeight: "600",
    textAlign: "right",
    fontSize: 14,
  },
  rowRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  logoutWrap: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  logoutBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  copyright: {
    textAlign: "center",
    marginTop: Spacing.xl,
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    marginBottom: Spacing.md,
  },
});
