// Smart Health Notification Rules
// لا توجد إشعارات push مفعّلة الآن — هذا الملف يحدد القواعد للتفعيل المستقبلي

export const NOTIFICATION_RULES = {
  // لا تكرر نفس التنبيه في أقل من 6 ساعات
  minIntervalBetweenSameAlert: 6 * 60 * 60 * 1000, // ms
  // لا ترسل أكثر من 3 تنبيهات يومياً
  maxAlertsPerDay: 3,
  // ساعات الصمت: 10 مساءً إلى 7 صباحاً
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
  | "general";

export interface AlertRecord {
  type: AlertType;
  sentAt: number; // timestamp
}

// ── هل نحن في ساعات الصمت؟ ──────────────────────────────────────────────────
export function isInQuietHours(): boolean {
  const hour = new Date().getHours();
  const { quietHoursStart, quietHoursEnd } = NOTIFICATION_RULES;
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

// ── هل يمكن إرسال التنبيه؟ ───────────────────────────────────────────────────
export function canSendAlert(
  type: AlertType,
  history: AlertRecord[],
  todayCount: number,
): boolean {
  if (isInQuietHours()) return false;
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

// ── قواعد التنبيه بناءً على الحالة الصحية ───────────────────────────────────
// تُستخدم مستقبلاً مع push notifications
export const ALERT_MESSAGES: Record<AlertType, string> = {
  heart_rate_high: "لاحظنا ارتفاعاً في نبض قلبك. جرّب الراحة والتنفس بهدوء.",
  heart_rate_low: "نبض قلبك أقل من المعتاد. راقب حالتك.",
  bp_high: "ضغط دمك مرتفع قليلاً. قلّل التوتر والملح.",
  bp_low: "ضغط دمك منخفض. اشرب ماء واحرص على وجبات منتظمة.",
  activity_low: "نشاطك اليوم منخفض. المشي لدقائق قد يساعدك.",
  sleep_low: "نومك أقل من المعتاد. حاول النوم مبكراً الليلة.",
  general: "تذكّر الاهتمام بصحتك اليوم.",
};
