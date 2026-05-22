// Health Settings Service — حفظ وقراءة إعدادات النظام الصحي
// يستخدم AsyncStorage الموجود فقط — لا مكتبات جديدة
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── الأنواع ────────────────────────────────────────────────────────────────────
export interface HealthGoals {
  stepsGoal: number;    // افتراضي 6000
  sleepGoal: number;    // ساعات، افتراضي 8
  activityGoal: number; // دقائق، افتراضي 30
}

export interface NotificationPreferences {
  heartRate: boolean;
  sleep: boolean;
  activity: boolean;
  oxygen: boolean;
  bloodPressure: boolean;
  dailySummary: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startHour: number;   // 0-23، افتراضي 22
  endHour: number;     // 0-23، افتراضي 7
}

export interface PrivacyPreferences {
  localOnly: boolean;
  allowFutureSync: boolean;
}

export interface HealthSettings {
  goals: HealthGoals;
  notifications: NotificationPreferences;
  quietHours: QuietHours;
  privacy: PrivacyPreferences;
}

// ── مفاتيح التخزين ────────────────────────────────────────────────────────────
const KEYS = {
  goals: "@taryaq_health_goals",
  notifications: "@taryaq_health_notification_preferences",
  quietHours: "@taryaq_health_quiet_hours",
  privacy: "@taryaq_health_privacy",
  healthCache: "@taryaq_health_cache",
  lastSync: "@taryaq_health_last_sync",
  modalDismissed: "@taryaq_health_modal_dismissed",
} as const;

// ── القيم الافتراضية ──────────────────────────────────────────────────────────
export const DEFAULT_GOALS: HealthGoals = {
  stepsGoal: 6000,
  sleepGoal: 8,
  activityGoal: 30,
};

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  heartRate: true,
  sleep: true,
  activity: true,
  oxygen: false,
  bloodPressure: true,
  dailySummary: true,
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  startHour: 22,
  endHour: 7,
};

export const DEFAULT_PRIVACY: PrivacyPreferences = {
  localOnly: true,
  allowFutureSync: false,
};

// ── مساعد: تحليل JSON آمن ─────────────────────────────────────────────────────
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

// ── الأهداف ────────────────────────────────────────────────────────────────────
export async function loadGoals(): Promise<HealthGoals> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.goals);
    return safeParse<HealthGoals>(raw, DEFAULT_GOALS);
  } catch {
    return DEFAULT_GOALS;
  }
}

export async function saveGoals(goals: HealthGoals): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.goals, JSON.stringify(goals)); } catch {}
}

// ── إعدادات التنبيهات ─────────────────────────────────────────────────────────
export async function loadNotificationPrefs(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.notifications);
    return safeParse<NotificationPreferences>(raw, DEFAULT_NOTIFICATIONS);
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPreferences,
): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.notifications, JSON.stringify(prefs)); } catch {}
}

// ── وقت الهدوء ────────────────────────────────────────────────────────────────
export async function loadQuietHours(): Promise<QuietHours> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.quietHours);
    return safeParse<QuietHours>(raw, DEFAULT_QUIET_HOURS);
  } catch {
    return DEFAULT_QUIET_HOURS;
  }
}

export async function saveQuietHours(qh: QuietHours): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.quietHours, JSON.stringify(qh)); } catch {}
}

// ── الخصوصية ──────────────────────────────────────────────────────────────────
export async function loadPrivacy(): Promise<PrivacyPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.privacy);
    return safeParse<PrivacyPreferences>(raw, DEFAULT_PRIVACY);
  } catch {
    return DEFAULT_PRIVACY;
  }
}

export async function savePrivacy(prefs: PrivacyPreferences): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.privacy, JSON.stringify(prefs)); } catch {}
}

// ── تحميل كل الإعدادات دفعة واحدة ───────────────────────────────────────────
export async function loadAllHealthSettings(): Promise<HealthSettings> {
  const [goals, notifications, quietHours, privacy] = await Promise.all([
    loadGoals(),
    loadNotificationPrefs(),
    loadQuietHours(),
    loadPrivacy(),
  ]);
  return { goals, notifications, quietHours, privacy };
}

// ── حذف البيانات الصحية المحلية فقط (ليس الإعدادات) ─────────────────────────
export async function deleteLocalHealthData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.healthCache, KEYS.lastSync, KEYS.modalDismissed]);
  } catch {}
}

// ── هل نحن في وقت الهدوء بناءً على الإعدادات؟ ────────────────────────────────
export function isInQuietHoursSettings(qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const hour = new Date().getHours();
  if (qh.startHour > qh.endHour) {
    // يعبر منتصف الليل: مثلاً 22 → 7
    return hour >= qh.startHour || hour < qh.endHour;
  }
  return hour >= qh.startHour && hour < qh.endHour;
}
