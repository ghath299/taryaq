import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Switch,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Text,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Stack, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import {
  loadAllHealthSettings,
  saveGoals,
  saveNotificationPrefs,
  saveQuietHours,
  savePrivacy,
  deleteLocalHealthData,
  type HealthGoals,
  type NotificationPreferences,
  type QuietHours,
  type PrivacyPreferences,
  DEFAULT_GOALS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_QUIET_HOURS,
  DEFAULT_PRIVACY,
} from "@/services/healthSettingsService";
import { sendTestHealthNotification } from "@/services/smartHealthNotificationService";
import {
  isHealthConnectAvailable,
  initializeHealthConnect,
  requestHealthConnectPermissions,
  getGrantedHealthPermissions,
  openHealthConnectSettingsScreen,
} from "@/services/healthConnectAdapter";

const BRAND_BLUE_DEEP = "#1F40C8";
const BRAND_CYAN = "#5EDFFF";
const MEDICAL_DISCLAIMER =
  "ترياق يعرض مؤشرات صحية عامة اعتماداً على البيانات المتاحة من جهازك أو تطبيقات الصحة. هذه المعلومات لا تُعد تشخيصاً طبياً ولا تغني عن استشارة الطبيب.";

// ── مساعد: تنسيق الساعة ───────────────────────────────────────────────────────
function formatHour(h: number): string {
  const ampm = h < 12 ? "ص" : "م";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${ampm}`;
}

// ── Stepper Component ─────────────────────────────────────────────────────────
interface StepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

function Stepper({ value, onDecrement, onIncrement, label, cardBg, textPrimary, textSecondary, border }: StepperProps) {
  return (
    <View style={[ss.stepperRow, { borderBottomColor: border }]}>
      <View style={ss.stepperControls}>
        <Pressable
          onPress={onIncrement}
          style={[ss.stepBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1), borderColor: addAlpha(BRAND_BLUE_DEEP, 0.2) }]}
          accessibilityRole="button"
        >
          <Feather name="plus" size={16} color={BRAND_BLUE_DEEP} />
        </Pressable>
        <Text style={[ss.stepValue, { color: textPrimary, fontFamily: "Tajawal_700Bold" }]}>
          {value.toLocaleString("ar")}
        </Text>
        <Pressable
          onPress={onDecrement}
          style={[ss.stepBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1), borderColor: addAlpha(BRAND_BLUE_DEEP, 0.2) }]}
          accessibilityRole="button"
        >
          <Feather name="minus" size={16} color={BRAND_BLUE_DEEP} />
        </Pressable>
      </View>
      <Text style={[ss.stepLabel, { color: textSecondary, fontFamily: "Tajawal_500Medium" }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Hour Stepper ───────────────────────────────────────────────────────────────
interface HourStepperProps {
  hour: number;
  label: string;
  onChange: (h: number) => void;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

function HourStepper({ hour, label, onChange, textPrimary, textSecondary, border }: HourStepperProps) {
  const dec = () => onChange(hour === 0 ? 23 : hour - 1);
  const inc = () => onChange(hour === 23 ? 0 : hour + 1);
  return (
    <View style={[ss.stepperRow, { borderBottomColor: border }]}>
      <View style={ss.stepperControls}>
        <Pressable onPress={inc} style={[ss.stepBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1), borderColor: addAlpha(BRAND_BLUE_DEEP, 0.2) }]}>
          <Feather name="chevron-up" size={16} color={BRAND_BLUE_DEEP} />
        </Pressable>
        <Text style={[ss.stepValue, { color: textPrimary, fontFamily: "Tajawal_700Bold", fontSize: 14 }]}>
          {formatHour(hour)}
        </Text>
        <Pressable onPress={dec} style={[ss.stepBtn, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.1), borderColor: addAlpha(BRAND_BLUE_DEEP, 0.2) }]}>
          <Feather name="chevron-down" size={16} color={BRAND_BLUE_DEEP} />
        </Pressable>
      </View>
      <Text style={[ss.stepLabel, { color: textSecondary, fontFamily: "Tajawal_500Medium" }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Switch Row ─────────────────────────────────────────────────────────────────
interface SwitchRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
  textPrimary: string;
  textSecondary?: string;
  subtitle?: string;
  border: string;
  last?: boolean;
}

function SwitchRow({ label, value, onToggle, textPrimary, textSecondary, subtitle, border, last }: SwitchRowProps) {
  return (
    <View style={[ss.switchRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }]}>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: addAlpha("#6B7280", 0.3), true: addAlpha(BRAND_BLUE_DEEP, 0.6) }}
        thumbColor={value ? BRAND_BLUE_DEEP : "#9CA3AF"}
        ios_backgroundColor={addAlpha("#6B7280", 0.2)}
      />
      <View style={ss.switchLabelWrap}>
        <Text style={[ss.switchLabel, { color: textPrimary, fontFamily: "Tajawal_500Medium" }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[ss.switchSubtitle, { color: textSecondary, fontFamily: "Tajawal_400Regular" }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function HealthSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [goals, setGoals]           = useState<HealthGoals>(DEFAULT_GOALS);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [quietHours, setQuietHours] = useState<QuietHours>(DEFAULT_QUIET_HOURS);
  const [privacy, setPrivacy]       = useState<PrivacyPreferences>(DEFAULT_PRIVACY);
  const [loading, setLoading]       = useState(true);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Health Connect state ──────────────────────────────────────────────────
  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null);
  const [hcGranted,   setHcGranted]   = useState<string[]>([]);
  const [hcChecking,  setHcChecking]  = useState(false);
  const [hcMsg,       setHcMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const screenBg    = isDark ? "#0A0F1A" : "#F5F7FB";
  const cardBg      = isDark ? "#161B22" : "#FFFFFF";
  const border      = isDark ? "#21262D" : "#EFEFEF";
  const textPrimary = isDark ? "#F0F6FC" : "#0F172A";
  const textSec     = isDark ? "#8B95A5" : "#6B7280";
  const sectionTitle = isDark ? "#8B95A5" : "#6B7280";

  // ── تحميل الإعدادات ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadAllHealthSettings()
      .then((s) => {
        setGoals(s.goals);
        setNotifPrefs(s.notifications);
        setQuietHours(s.quietHours);
        setPrivacy(s.privacy);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── فحص Health Connect عند فتح الشاشة (Android فقط) ─────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    setHcChecking(true);
    isHealthConnectAvailable()
      .then(async (available) => {
        setHcAvailable(available);
        if (available) {
          await initializeHealthConnect();
          const granted = await getGrantedHealthPermissions();
          setHcGranted(granted);
        }
      })
      .catch(() => setHcAvailable(false))
      .finally(() => setHcChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── طلب صلاحيات HC ────────────────────────────────────────────────────────
  const handleRequestHCPerms = useCallback(async () => {
    setHcChecking(true);
    setHcMsg(null);
    try {
      const ok = await requestHealthConnectPermissions();
      if (ok) {
        const granted = await getGrantedHealthPermissions();
        setHcGranted(granted);
        setHcMsg({ ok: true, text: `تم منح ${granted.length} صلاحية` });
      } else {
        setHcMsg({ ok: false, text: "لم تُمنح الصلاحيات — افتح إعدادات HC للسماح يدوياً" });
      }
    } catch {
      setHcMsg({ ok: false, text: "خطأ أثناء طلب الصلاحيات" });
    } finally {
      setHcChecking(false);
    }
  }, []);

  // ── إعادة فحص HC ──────────────────────────────────────────────────────────
  const handleRecheckHC = useCallback(async () => {
    setHcChecking(true);
    setHcMsg(null);
    try {
      const available = await isHealthConnectAvailable();
      setHcAvailable(available);
      if (available) {
        await initializeHealthConnect();
        const granted = await getGrantedHealthPermissions();
        setHcGranted(granted);
        setHcMsg({ ok: true, text: available ? "Health Connect متاح" : "غير متاح" });
      } else {
        setHcMsg({ ok: false, text: "Health Connect غير متاح على هذا الجهاز" });
      }
    } catch {
      setHcMsg({ ok: false, text: "تعذّر الفحص" });
    } finally {
      setHcChecking(false);
    }
  }, []);

  // ── تحديث الأهداف ─────────────────────────────────────────────────────────────
  const updateGoal = useCallback(
    (key: keyof HealthGoals, delta: number) => {
      setGoals((prev) => {
        const config: Record<keyof HealthGoals, { min: number; max: number; step: number }> = {
          stepsGoal:    { min: 1000, max: 20000, step: 500 },
          sleepGoal:    { min: 4,    max: 12,    step: 1   },
          activityGoal: { min: 10,   max: 120,   step: 5   },
        };
        const { min, max, step } = config[key];
        const next = { ...prev, [key]: Math.min(max, Math.max(min, prev[key] + delta * step)) };
        void saveGoals(next);
        return next;
      });
    },
    [],
  );

  // ── تبديل التنبيهات ───────────────────────────────────────────────────────────
  const toggleNotif = useCallback((key: keyof NotificationPreferences) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void saveNotificationPrefs(next);
      return next;
    });
  }, []);

  // ── تحديث وقت الهدوء ────────────────────────────────────────────────────────
  const updateQH = useCallback(<K extends keyof QuietHours>(key: K, value: QuietHours[K]) => {
    setQuietHours((prev) => {
      const next = { ...prev, [key]: value };
      void saveQuietHours(next);
      return next;
    });
  }, []);

  // ── الخصوصية ───────────────────────────────────────────────────────────────
  const togglePrivacy = useCallback((key: keyof PrivacyPreferences) => {
    setPrivacy((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void savePrivacy(next);
      return next;
    });
  }, []);

  // ── حذف البيانات ─────────────────────────────────────────────────────────────
  const handleTestNotification = useCallback(async () => {
    setTestSending(true);
    setTestResult(null);
    const result = await sendTestHealthNotification();
    setTestSending(false);
    setTestResult({ ok: result.success, msg: result.success ? "تم إرسال التنبيه التجريبي!" : result.reason ?? "فشل الإرسال" });
  }, []);

  const handleDeleteData = () => {
    const msg = "سيتم حذف بيانات الصحة المحفوظة محلياً (الكاش). لن تُحذف إعداداتك.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) {
        void deleteLocalHealthData();
      }
      return;
    }
    Alert.alert("حذف بيانات الصحة", msg, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => void deleteLocalHealthData() },
    ]);
  };

  if (loading) {
    return (
      <View style={[ss.loadingContainer, { backgroundColor: screenBg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={BRAND_BLUE_DEEP} />
      </View>
    );
  }

  return (
    <View style={[ss.root, { backgroundColor: screenBg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={[
          ss.header,
          { backgroundColor: cardBg, borderBottomColor: border, paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [ss.backBtn, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Feather name="arrow-right" size={22} color={textPrimary} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: textPrimary, fontFamily: "Tajawal_700Bold" }]}>
          إعدادات الصحة
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. حالة الربط ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>حالة الربط</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>

            {/* ── الحالة ─────────────────────────────────────────────────── */}
            <View style={[ss.statusRow, { borderBottomColor: border }]}>
              {hcChecking ? (
                <ActivityIndicator size="small" color={BRAND_BLUE_DEEP} style={{ marginLeft: 8 }} />
              ) : (
                <View style={[ss.statusDot, {
                  backgroundColor:
                    hcAvailable === null  ? "#9CA3AF"
                    : hcAvailable && hcGranted.length > 0 ? "#22C55E"
                    : hcAvailable         ? "#F97316"
                    : "#EF4444",
                }]} />
              )}
              <View style={ss.statusTextWrap}>
                <Text style={[ss.rowLabel, { color: textPrimary, fontFamily: "Tajawal_500Medium" }]}>
                  الحالة
                </Text>
                <Text style={[ss.rowMeta, { color: textSec, fontFamily: "Tajawal_400Regular" }]}>
                  {Platform.OS !== "android"
                    ? (Platform.OS === "ios" ? "iOS — HealthKit غير مفعّل بعد" : "ويب / محاكي — بيانات تجريبية")
                    : hcChecking         ? "جارٍ الفحص…"
                    : hcAvailable === null ? "لم يُفحص بعد"
                    : hcAvailable && hcGranted.length > 0 ? `مرتبط — ${hcGranted.length} صلاحية`
                    : hcAvailable         ? "متاح — لم تُمنح صلاحيات بعد"
                    : "Health Connect غير متوفر"}
                </Text>
              </View>
            </View>

            {/* ── المصدر ─────────────────────────────────────────────────── */}
            <View style={[ss.statusRow, { borderBottomColor: border }]}>
              <Feather name="cpu" size={16} color={textSec} style={{ marginLeft: 8 }} />
              <View style={ss.statusTextWrap}>
                <Text style={[ss.rowLabel, { color: textPrimary, fontFamily: "Tajawal_500Medium" }]}>
                  المصدر الحالي
                </Text>
                <Text style={[ss.rowMeta, { color: textSec, fontFamily: "Tajawal_400Regular" }]}>
                  {Platform.OS === "android" && hcAvailable && hcGranted.length > 0
                    ? "Health Connect (بيانات حقيقية)"
                    : Platform.OS === "android" && hcAvailable
                    ? "Health Connect (بدون صلاحيات)"
                    : "بيانات تجريبية للمعاينة"}
                </Text>
              </View>
            </View>

            {/* ── رسالة الحالة ───────────────────────────────────────────── */}
            {hcMsg && (
              <View style={[ss.hcMsgRow, {
                backgroundColor: hcMsg.ok ? addAlpha("#22C55E", 0.08) : addAlpha("#EF4444", 0.08),
                borderColor:     hcMsg.ok ? addAlpha("#22C55E", 0.25) : addAlpha("#EF4444", 0.25),
              }]}>
                <Feather
                  name={hcMsg.ok ? "check-circle" : "alert-circle"}
                  size={13}
                  color={hcMsg.ok ? "#22C55E" : "#EF4444"}
                  style={{ marginLeft: 6 }}
                />
                <Text style={[ss.hcMsgText, { color: hcMsg.ok ? "#22C55E" : "#EF4444", fontFamily: "Tajawal_400Regular" }]}>
                  {hcMsg.text}
                </Text>
              </View>
            )}

            {/* ── أزرار Android ──────────────────────────────────────────── */}
            {Platform.OS === "android" ? (
              <>
                {hcAvailable && (
                  <Pressable
                    onPress={() => void handleRequestHCPerms()}
                    disabled={hcChecking}
                    style={({ pressed }) => [
                      ss.actionBtn,
                      { backgroundColor: addAlpha(BRAND_BLUE_DEEP, hcChecking ? 0.05 : 0.1), opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityRole="button"
                  >
                    {hcChecking ? (
                      <ActivityIndicator size="small" color={BRAND_BLUE_DEEP} />
                    ) : (
                      <Feather name="shield" size={15} color={BRAND_BLUE_DEEP} />
                    )}
                    <Text style={[ss.actionBtnLabel, { color: BRAND_BLUE_DEEP, fontFamily: "Tajawal_600SemiBold" }]}>
                      {hcGranted.length > 0 ? "تحديث الصلاحيات" : "طلب صلاحيات القراءة"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => void openHealthConnectSettingsScreen()}
                  style={({ pressed }) => [
                    ss.actionBtn,
                    { backgroundColor: addAlpha(BRAND_BLUE_DEEP, 0.06), opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="external-link" size={15} color={BRAND_BLUE_DEEP} />
                  <Text style={[ss.actionBtnLabel, { color: BRAND_BLUE_DEEP, fontFamily: "Tajawal_600SemiBold" }]}>
                    إعدادات Health Connect
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleRecheckHC()}
                  disabled={hcChecking}
                  style={({ pressed }) => [
                    ss.actionBtn,
                    { backgroundColor: addAlpha("#6B7280", 0.07), opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="refresh-cw" size={14} color={textSec} />
                  <Text style={[ss.actionBtnLabel, { color: textSec, fontFamily: "Tajawal_500Medium" }]}>
                    إعادة فحص التوفر
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={[ss.actionBtn, { backgroundColor: addAlpha("#9CA3AF", 0.08) }]}>
                <Feather name="info" size={14} color={textSec} />
                <Text style={[ss.actionBtnLabel, { color: textSec, fontFamily: "Tajawal_400Regular" }]}>
                  {Platform.OS === "ios" ? "HealthKit سيُفعَّل في إصدار قادم" : "يعمل على Android فقط"}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── 2. أهدافي الصحية ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>أهدافي الصحية</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Stepper
              label="الخطوات اليومية (خطوة)"
              value={goals.stepsGoal}
              onDecrement={() => updateGoal("stepsGoal", -1)}
              onIncrement={() => updateGoal("stepsGoal", +1)}
              cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSec} border={border}
            />
            <Stepper
              label="هدف النوم (ساعة)"
              value={goals.sleepGoal}
              onDecrement={() => updateGoal("sleepGoal", -1)}
              onIncrement={() => updateGoal("sleepGoal", +1)}
              cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSec} border={border}
            />
            <Stepper
              label="هدف النشاط (دقيقة)"
              value={goals.activityGoal}
              onDecrement={() => updateGoal("activityGoal", -1)}
              onIncrement={() => updateGoal("activityGoal", +1)}
              cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSec} border={border}
            />
            <Text style={[ss.hintText, { color: textSec, fontFamily: "Tajawal_400Regular" }]}>
              تُحفظ تلقائياً • تُستخدم في تحليل مؤشراتك اليومية
            </Text>
          </View>
        </Animated.View>

        {/* ── 3. التنبيهات الذكية ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>التنبيهات الذكية</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>
            <SwitchRow label="تنبيهات نبض القلب" value={notifPrefs.heartRate}
              onToggle={() => toggleNotif("heartRate")} textPrimary={textPrimary} textSecondary={textSec} border={border} />
            <SwitchRow label="تنبيهات النوم" value={notifPrefs.sleep}
              onToggle={() => toggleNotif("sleep")} textPrimary={textPrimary} textSecondary={textSec} border={border} />
            <SwitchRow label="تنبيهات النشاط" value={notifPrefs.activity}
              onToggle={() => toggleNotif("activity")} textPrimary={textPrimary} textSecondary={textSec} border={border} />
            <SwitchRow label="تنبيهات الأوكسجين" value={notifPrefs.oxygen}
              onToggle={() => toggleNotif("oxygen")} textPrimary={textPrimary} textSecondary={textSec} border={border} />
            <SwitchRow label="تنبيهات ضغط الدم" value={notifPrefs.bloodPressure}
              onToggle={() => toggleNotif("bloodPressure")} textPrimary={textPrimary} textSecondary={textSec} border={border} />
            <SwitchRow label="ملخص يومي" value={notifPrefs.dailySummary}
              subtitle="إشعار يومي بمؤشراتك الصحية"
              onToggle={() => toggleNotif("dailySummary")}
              textPrimary={textPrimary} textSecondary={textSec} border={border} last />
          </View>
        </Animated.View>

        {/* ── 4. وقت الهدوء ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>وقت الهدوء</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>
            <SwitchRow
              label="تفعيل وقت الهدوء"
              subtitle="لا تُرسل تنبيهات خلال الساعات المحددة"
              value={quietHours.enabled}
              onToggle={() => updateQH("enabled", !quietHours.enabled)}
              textPrimary={textPrimary} textSecondary={textSec} border={border}
            />
            {quietHours.enabled && (
              <>
                <HourStepper
                  label="بداية وقت الهدوء"
                  hour={quietHours.startHour}
                  onChange={(h) => updateQH("startHour", h)}
                  textPrimary={textPrimary} textSecondary={textSec} border={border}
                />
                <HourStepper
                  label="نهاية وقت الهدوء"
                  hour={quietHours.endHour}
                  onChange={(h) => updateQH("endHour", h)}
                  textPrimary={textPrimary} textSecondary={textSec} border={border}
                />
              </>
            )}
            <Text style={[ss.hintText, { color: textSec, fontFamily: "Tajawal_400Regular" }]}>
              لا تُرسل تنبيهات فعلية الآن — الإعدادات محفوظة للتفعيل المستقبلي
            </Text>
          </View>
        </Animated.View>

        {/* ── 5. الخصوصية ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>الخصوصية</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>
            <SwitchRow
              label="حفظ البيانات محلياً فقط"
              subtitle="لا تُرسل بياناتك الصحية لأي خادم"
              value={privacy.localOnly}
              onToggle={() => togglePrivacy("localOnly")}
              textPrimary={textPrimary} textSecondary={textSec} border={border}
            />
            <SwitchRow
              label="السماح بالمزامنة المستقبلية"
              subtitle="للتمكين عند توفر خاصية المزامنة"
              value={privacy.allowFutureSync}
              onToggle={() => togglePrivacy("allowFutureSync")}
              textPrimary={textPrimary} textSecondary={textSec} border={border} last
            />
            <View style={[ss.divider, { backgroundColor: border }]} />
            <Pressable
              onPress={handleDeleteData}
              style={({ pressed }) => [ss.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={15} color="#EF4444" />
              <Text style={[ss.deleteBtnLabel, { fontFamily: "Tajawal_500Medium" }]}>
                حذف بيانات الصحة المحلية
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── 6. اختبار التنبيهات ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(270).duration(400)}>
          <Text style={[ss.sectionTitle, { color: sectionTitle }]}>اختبار التنبيهات</Text>
          <View style={[ss.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ padding: Spacing.md }}>
              <Text style={[ss.rowLabel, { color: textPrimary, fontFamily: "Tajawal_500Medium", marginBottom: 6 }]}>
                إرسال تنبيه تجريبي
              </Text>
              <Text style={[ss.rowMeta, { color: textSec, fontFamily: "Tajawal_400Regular", marginBottom: 12 }]}>
                للتحقق من عمل الإشعارات على جهازك. لا يُرسل بيانات طبية حقيقية.
              </Text>
              <Pressable
                onPress={() => void handleTestNotification()}
                disabled={testSending}
                style={({ pressed }) => [
                  ss.testBtn,
                  {
                    backgroundColor: testSending
                      ? addAlpha(BRAND_BLUE_DEEP, 0.4)
                      : addAlpha(BRAND_BLUE_DEEP, 0.1),
                    borderColor: addAlpha(BRAND_BLUE_DEEP, 0.25),
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                {testSending ? (
                  <ActivityIndicator size="small" color={BRAND_BLUE_DEEP} />
                ) : (
                  <Feather name="bell" size={15} color={BRAND_BLUE_DEEP} />
                )}
                <Text style={[ss.testBtnLabel, { color: BRAND_BLUE_DEEP, fontFamily: "Tajawal_600SemiBold" }]}>
                  {testSending ? "جارٍ الإرسال..." : "إرسال تنبيه تجريبي"}
                </Text>
              </Pressable>
              {testResult && (
                <View
                  style={[
                    ss.testResult,
                    {
                      backgroundColor: testResult.ok
                        ? addAlpha("#22C55E", 0.1)
                        : addAlpha("#EF4444", 0.1),
                      borderColor: testResult.ok
                        ? addAlpha("#22C55E", 0.3)
                        : addAlpha("#EF4444", 0.3),
                    },
                  ]}
                >
                  <Feather
                    name={testResult.ok ? "check-circle" : "alert-circle"}
                    size={14}
                    color={testResult.ok ? "#22C55E" : "#EF4444"}
                    style={{ marginLeft: 8 }}
                  />
                  <Text style={[ss.testResultText, { color: testResult.ok ? "#22C55E" : "#EF4444", fontFamily: "Tajawal_500Medium" }]}>
                    {testResult.msg}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── 7. تنبيه طبي ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={[ss.disclaimerCard, { backgroundColor: addAlpha(BRAND_BLUE_DEEP, isDark ? 0.12 : 0.06), borderColor: addAlpha(BRAND_BLUE_DEEP, 0.18) }]}>
            <Feather name="info" size={16} color={BRAND_BLUE_DEEP} style={{ marginLeft: 10, marginTop: 2 }} />
            <Text style={[ss.disclaimerText, { color: isDark ? addAlpha("#A0B4F0", 0.9) : addAlpha(BRAND_BLUE_DEEP, 0.8), fontFamily: "Tajawal_400Regular" }]}>
              {MEDICAL_DISCLAIMER}
            </Text>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },

  scrollContent: { padding: Spacing.md, gap: 0 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: 6,
    marginHorizontal: 4,
    letterSpacing: 0.3,
  },

  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 4,
  },

  // HC message row
  hcMsgRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 6,
  },
  hcMsgText: { flex: 1, fontSize: 12, textAlign: "right" },

  // Connection status
  statusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  statusTextWrap: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "500" },
  rowMeta: { fontSize: 12, marginTop: 2 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  actionBtnLabel: { fontSize: 14, fontWeight: "600" },

  // Stepper
  stepperRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  stepperControls: { flexDirection: "row-reverse", alignItems: "center", gap: 14 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stepValue: { fontSize: 17, fontWeight: "700", minWidth: 60, textAlign: "center" },
  stepLabel: { fontSize: 13, flex: 1, textAlign: "right" },

  // Switch
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: 12,
  },
  switchLabelWrap: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: "500" },
  switchSubtitle: { fontSize: 12, marginTop: 2 },

  hintText: {
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    paddingBottom: 12,
  },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.md },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  deleteBtnLabel: { fontSize: 14, color: "#EF4444" },

  disclaimerCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  disclaimerText: { flex: 1, fontSize: 12.5, lineHeight: 20, textAlign: "right" },

  // Test notification section
  testBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  testBtnLabel: { fontSize: 14, fontWeight: "600" },
  testResult: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 6,
  },
  testResultText: { fontSize: 13, flex: 1, textAlign: "right" },
});
