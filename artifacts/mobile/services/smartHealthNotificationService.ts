// Smart Health Notification Service — إشعارات محلية ذكية داخل الجهاز فقط
// لا push notifications من سيرفر، لا Health Connect، لا HealthKit
// يعمل فقط مع expo-notifications المحلي

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HealthSummary } from "./healthDataService";
import { loadAllHealthSettings, isInQuietHoursSettings } from "./healthSettingsService";
import type { NotificationPreferences, QuietHours, HealthGoals } from "./healthSettingsService";

// ── مفاتيح التخزين ────────────────────────────────────────────────────────────
const KEYS = {
  lastNotifications: "@taryaq_health_last_notifications",
  dailyCount:        "@taryaq_health_daily_notification_count",
  permissionStatus:  "@taryaq_health_notification_permission_status",
} as const;

const MAX_DAILY        = 3;
const MIN_INTERVAL_MS  = 6 * 60 * 60 * 1000; // 6 ساعات
const CHANNEL_ID       = "health-alerts";

// ── الأنواع ────────────────────────────────────────────────────────────────────
type AlertType =
  | "heart_rate_high"
  | "heart_rate_low"
  | "sleep_low"
  | "activity_low"
  | "oxygen_low"          // يعتمد على data.spo2.latest أو data.spo2.average
  | "blood_pressure_high"
  | "blood_pressure_low"
  | "daily_summary"
  | "test";

interface NotifRecord {
  type: AlertType;
  sentAt: number;
}

interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

// ── نصوص التنبيهات ────────────────────────────────────────────────────────────
const ALERT_CONTENT: Record<AlertType, { title: string; body: string }> = {
  heart_rate_high: {
    title: "مؤشر نبض يحتاج انتباه",
    body: "لاحظنا أن معدل نبضك أعلى من المعتاد. جرّب الجلوس والتنفس بهدوء لبضع دقائق. إذا استمرت الأعراض راجع مختصاً.",
  },
  heart_rate_low: {
    title: "مؤشر نبض منخفض",
    body: "نبضك أقل من المعتاد اليوم. إذا تشعر بدوخة أو تعب، خذ قسطاً من الراحة وراقب حالتك. إذا استمرت الأعراض راجع مختصاً.",
  },
  sleep_low: {
    title: "نومك كان أقل من المعتاد",
    body: "يبدو أن نومك اليوم أقل من هدفك. حاول تنظيم وقت النوم الليلة.",
  },
  activity_low: {
    title: "حان وقت الحركة",
    body: "نشاطك اليوم أقل من هدفك. المشي لدقائق بسيطة قد يساعد جسمك.",
  },
  blood_pressure_high: {
    title: "مؤشر الضغط مرتفع قليلاً",
    body: "ضغطك يبدو مرتفعاً قليلاً. قلّل التوتر والملح وراقب القراءات. إذا استمر راجع مختصاً.",
  },
  blood_pressure_low: {
    title: "مؤشر الضغط منخفض قليلاً",
    body: "ضغطك منخفض قليلاً. اشرب ماء كافياً واحرص على وجبات منتظمة.",
  },
  oxygen_low: {
    title: "مؤشر الأوكسجين يستحق الانتباه",
    body: "مستوى الأوكسجين لديك يحتاج انتباهاً. تنفّس بعمق وراقب حالتك. إذا استمرت الأعراض راجع مختصاً.",
  },
  daily_summary: {
    title: "ملخص صحتك اليوم",
    body: "راجع مؤشراتك اليومية ونصيحة ترياق الصحية لهذا اليوم.",
  },
  test: {
    title: "ترياق يهتم بصحتك",
    body: "هذا تنبيه تجريبي من نظام الصحة الذكي.",
  },
};

// ── Android Channel ────────────────────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "تنبيهات الصحة",
      description: "تنبيهات صحية عامة من ترياق",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#5EDFFF",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: null,
    });
  } catch {}
}

// ── طلب صلاحية الإشعارات ─────────────────────────────────────────────────────
export async function requestHealthNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") {
      await AsyncStorage.setItem(KEYS.permissionStatus, "granted").catch(() => {});
      return true;
    }
    if (existing === "denied") return false;
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(KEYS.permissionStatus, status).catch(() => {});
    return status === "granted";
  } catch {
    return false;
  }
}

// ── AsyncStorage: تاريخ التنبيهات ────────────────────────────────────────────
async function loadHistory(): Promise<NotifRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.lastNotifications);
    if (!raw) return [];
    return JSON.parse(raw) as NotifRecord[];
  } catch {
    return [];
  }
}

async function saveHistory(records: NotifRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.lastNotifications, JSON.stringify(records.slice(0, 100)));
  } catch {}
}

// ── AsyncStorage: عداد اليومي ─────────────────────────────────────────────────
async function getTodayCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.dailyCount);
    if (!raw) return 0;
    const data = JSON.parse(raw) as DailyCount;
    const today = new Date().toISOString().slice(0, 10);
    return data.date === today ? data.count : 0;
  } catch {
    return 0;
  }
}

async function incrementTodayCount(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const current = await getTodayCount();
    await AsyncStorage.setItem(
      KEYS.dailyCount,
      JSON.stringify({ date: today, count: current + 1 }),
    );
  } catch {}
}

// ── هل أُرسل هذا النوع مؤخراً؟ ──────────────────────────────────────────────
function wasRecentlySent(history: NotifRecord[], type: AlertType): boolean {
  const last = history.find((r) => r.type === type);
  if (!last) return false;
  return Date.now() - last.sentAt < MIN_INTERVAL_MS;
}

// ── اختيار النوع الأهم (حسب الأولوية) ───────────────────────────────────────
function pickAlertType(
  data: HealthSummary,
  goals: HealthGoals,
  prefs: NotificationPreferences,
  history: NotifRecord[],
): AlertType | null {
  const ok = (type: AlertType): boolean => !wasRecentlySent(history, type);

  // 1. القلب
  if (data.heartRate.status === "high" && prefs.heartRate && ok("heart_rate_high")) {
    return "heart_rate_high";
  }
  if (data.heartRate.status === "low" && prefs.heartRate && ok("heart_rate_low")) {
    return "heart_rate_low";
  }

  // 2. الأوكسجين — يعمل فقط إذا توفرت بيانات spo2 فعلاً في HealthSummary
  const oxygenVal = data.spo2?.latest ?? data.spo2?.average ?? null;
  if (
    typeof oxygenVal === "number" &&
    oxygenVal < 94 &&
    prefs.oxygen &&
    ok("oxygen_low")
  ) {
    return "oxygen_low";
  }

  // 3. ضغط الدم
  if (data.bloodPressure.status === "high" && prefs.bloodPressure && ok("blood_pressure_high")) {
    return "blood_pressure_high";
  }
  if (data.bloodPressure.status === "low" && prefs.bloodPressure && ok("blood_pressure_low")) {
    return "blood_pressure_low";
  }

  // 4. النوم — أقل من 75% من الهدف
  if (
    data.sleep.hours !== null &&
    data.sleep.hours < goals.sleepGoal * 0.75 &&
    prefs.sleep &&
    ok("sleep_low")
  ) {
    return "sleep_low";
  }

  // 5. النشاط — أقل من 50% من هدف الخطوات
  if (
    data.activity.steps !== null &&
    data.activity.steps < goals.stepsGoal * 0.5 &&
    prefs.activity &&
    ok("activity_low")
  ) {
    return "activity_low";
  }

  // 6. ملخص يومي — كخيار أخير إذا مُفعَّل ولم يُرسَل مؤخراً
  if (prefs.dailySummary && ok("daily_summary")) {
    return "daily_summary";
  }

  return null;
}

// ── إرسال إشعار محلي ─────────────────────────────────────────────────────────
async function sendLocal(type: AlertType): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const content = ALERT_CONTENT[type];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body:  content.body,
        sound: "default",
        data:  { type, source: "health-smart" },
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null, // immediate
    });
    return true;
  } catch {
    return false;
  }
}

// ── الدالة الرئيسية: فحص وإرسال (تُستدعى من الصفحة الرئيسية) ─────────────────
export async function checkAndSendSmartHealthNotification(
  data: HealthSummary,
): Promise<void> {
  if (Platform.OS === "web") return;

  // لا ترسل للبيانات التجريبية خارج DEV mode
  if (data.source === "mock" && !__DEV__) return;

  // تحميل الإعدادات
  const settings = await loadAllHealthSettings();
  const { goals, notifications: prefs, quietHours } = settings;

  // احترام وقت الهدوء
  if (isInQuietHoursSettings(quietHours)) return;

  // حد 3 تنبيهات يومياً
  const todayCount = await getTodayCount();
  if (todayCount >= MAX_DAILY) return;

  // إذا كل التنبيهات مغلقة
  const anyEnabled =
    prefs.heartRate || prefs.sleep || prefs.activity ||
    prefs.bloodPressure || prefs.oxygen || prefs.dailySummary;
  if (!anyEnabled) return;

  // سجل التنبيهات السابقة
  const history = await loadHistory();

  // اختيار الأهم
  const alertType = pickAlertType(data, goals, prefs, history);
  if (!alertType) return;

  // طلب الصلاحية
  const granted = await requestHealthNotificationPermission();
  if (!granted) return;

  // إعداد القناة (Android)
  await setupNotificationChannel();

  // إرسال
  const sent = await sendLocal(alertType);
  if (sent) {
    await saveHistory([{ type: alertType, sentAt: Date.now() }, ...history]);
    await incrementTodayCount();
  }
}

// ── تنبيه تجريبي (من زر الإعدادات) ──────────────────────────────────────────
export async function sendTestHealthNotification(): Promise<{
  success: boolean;
  reason?: string;
}> {
  if (Platform.OS === "web") {
    return { success: false, reason: "الإشعارات غير متاحة على المتصفح" };
  }
  try {
    const granted = await requestHealthNotificationPermission();
    if (!granted) {
      return { success: false, reason: "لم تمنح صلاحية الإشعارات. فعّلها من إعدادات الجهاز." };
    }
    await setupNotificationChannel();
    const sent = await sendLocal("test");
    return sent
      ? { success: true }
      : { success: false, reason: "فشل إرسال التنبيه. حاول مجدداً." };
  } catch {
    return { success: false, reason: "حدث خطأ غير متوقع." };
  }
}
