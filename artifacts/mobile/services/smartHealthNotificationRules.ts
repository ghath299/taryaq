// Smart Health Notification Rules
// لا توجد إشعارات push مفعّلة الآن — هذا الملف يحدد القواعد للتفعيل المستقبلي
// تم ربطه بإعدادات المستخدم من healthSettingsService

import type { NotificationPreferences, QuietHours } from "./healthSettingsService";
import { isInQuietHoursSettings } from "./healthSettingsService";

export const NOTIFICATION_RULES = {
  // لا تكرر نفس التنبيه في أقل من 6 ساعات
  minIntervalBetweenSameAlert: 6 * 60 * 60 * 1000,
  // لا ترسل أكثر من 3 تنبيهات يومياً
  maxAlertsPerDay: 3,
  // ساعات الهدوء الافتراضية (تُستبدل بإعدادات المستخدم)
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

export type AlertType =
  | "heart_rate_high"
  | "heart_rate_low"
  | "bp_high"
  | "bp_low"
  | "activity_low"
  | "sleep_low"
  | "oxygen_low"
  | "daily_summary"
  | "general";

export interface AlertRecord {
  type: AlertType;
  sentAt: number;
}

// ── خريطة: AlertType → مفتاح NotificationPreferences ─────────────────────────
const ALERT_TO_PREF: Partial<Record<AlertType, keyof NotificationPreferences>> = {
  heart_rate_high: "heartRate",
  heart_rate_low:  "heartRate",
  bp_high:         "bloodPressure",
  bp_low:          "bloodPressure",
  activity_low:    "activity",
  sleep_low:       "sleep",
  oxygen_low:      "oxygen",
  daily_summary:   "dailySummary",
};

// ── هل نحن في ساعات الهدوء الافتراضية؟ ──────────────────────────────────────
export function isInQuietHours(): boolean {
  const hour = new Date().getHours();
  const { quietHoursStart, quietHoursEnd } = NOTIFICATION_RULES;
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

// ── هل يُسمح بالتنبيه (مع إعدادات المستخدم)؟ ────────────────────────────────
export function canSendAlert(
  type: AlertType,
  history: AlertRecord[],
  todayCount: number,
  prefs?: NotificationPreferences,
  quietHours?: QuietHours,
): boolean {
  // تحقق من إعداد التنبيه الخاص بهذا النوع
  if (prefs) {
    const prefKey = ALERT_TO_PREF[type];
    if (prefKey && !prefs[prefKey]) return false;
  }

  // تحقق من وقت الهدوء
  if (quietHours) {
    if (isInQuietHoursSettings(quietHours)) return false;
  } else {
    if (isInQuietHours()) return false;
  }

  if (todayCount >= NOTIFICATION_RULES.maxAlertsPerDay) return false;

  const lastSame = history
    .filter((r) => r.type === type)
    .sort((a, b) => b.sentAt - a.sentAt)[0];
  if (lastSame) {
    const elapsed = Date.now() - lastSame.sentAt;
    if (elapsed < NOTIFICATION_RULES.minIntervalBetweenSameAlert) return false;
  }
  return true;
}

// ── هل ملخص اليوم مسموح به؟ ──────────────────────────────────────────────────
export function isDailySummaryAllowed(
  prefs?: NotificationPreferences,
  quietHours?: QuietHours,
): boolean {
  if (prefs && !prefs.dailySummary) return false;
  if (quietHours && isInQuietHoursSettings(quietHours)) return false;
  return true;
}

export const ALERT_MESSAGES: Record<AlertType, string> = {
  heart_rate_high: "لاحظنا ارتفاعاً في نبض قلبك. جرّب الراحة والتنفس بهدوء.",
  heart_rate_low:  "نبض قلبك أقل من المعتاد. راقب حالتك.",
  bp_high:         "ضغط دمك مرتفع قليلاً. قلّل التوتر والملح.",
  bp_low:          "ضغط دمك منخفض. اشرب ماء واحرص على وجبات منتظمة.",
  activity_low:    "نشاطك اليوم منخفض. المشي لدقائق قد يساعدك.",
  sleep_low:       "نومك أقل من المعتاد. حاول النوم مبكراً الليلة.",
  oxygen_low:      "مستوى الأوكسجين يستحق الانتباه. تنفّس بعمق وأخبر طبيبك إن تكرر.",
  daily_summary:   "إليك ملخص مؤشراتك الصحية اليوم.",
  general:         "تذكّر الاهتمام بصحتك اليوم.",
};
