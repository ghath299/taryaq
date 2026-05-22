// Smart Health Analyzer — يأخذ HealthSummary ويُعيد نصيحة ذكية باللغة العربية
// ممنوع استخدام: خطر / مرض / تشخيص / علاج
// المستخدم: لاحظنا / قد يساعدك / راقب حالتك

import type { HealthSummary, ActivityLevel, HeartRateStatus, BPStatus } from "./healthDataService";
import type { HealthGoals } from "./healthSettingsService";
import { DEFAULT_GOALS } from "./healthSettingsService";

// ── النصيحة الذكية ────────────────────────────────────────────────────────────
// تقبل goals اختيارياً — تُستخدم بدل القيم الثابتة
export function getSmartHealthTip(data: HealthSummary, goals?: HealthGoals): string {
  const g: HealthGoals = { ...DEFAULT_GOALS, ...goals };
  const candidates: string[] = [];

  // النوم — مقارنة بهدف المستخدم
  if (data.sleep.hours !== null) {
    const criticalSleep = g.sleepGoal * 0.65;  // أقل من 65% من الهدف = منخفض جداً
    const lowSleep = g.sleepGoal * 0.875;       // أقل من 87.5% = يحتاج انتباهاً
    if (data.sleep.hours < criticalSleep) {
      candidates.push("نومك كان أقل من المعتاد. حاول تنظيم وقت نومك الليلة لتشعر بطاقة أفضل.");
    } else if (data.sleep.hours < lowSleep || data.sleep.quality === "poor") {
      candidates.push("جودة نومك تحتاج تحسيناً. ابتعد عن الشاشات قبل النوم بساعة وستلاحظ فرقاً.");
    }
  }

  // النشاط والخطوات — مقارنة بهدف الخطوات والنشاط
  if (data.activity.level === "low") {
    candidates.push("نشاطك اليوم أقل من المعتاد. المشي لدقائق بسيطة قد يساعدك على الشعور بنشاط أكبر.");
  } else if (data.activity.steps !== null && data.activity.steps < g.stepsGoal * 0.5) {
    // أقل من 50% من هدف الخطوات
    candidates.push("خطواتك اليوم قليلة. حاول التحرك أكثر ولو لمسافات قصيرة بين المهام.");
  } else if (data.activity.steps !== null && data.activity.steps < g.stepsGoal * 0.75) {
    // بين 50% و 75% من الهدف
    candidates.push(`أنت على بُعد ${(g.stepsGoal - data.activity.steps).toLocaleString("ar")} خطوة من هدفك اليومي. تحرّك قليلاً!`);
  }

  // نبض القلب
  if (data.heartRate.status === "high") {
    candidates.push("لاحظنا أن معدل نبضك أعلى من المعتاد. جرّب الجلوس والتنفس بهدوء لبضع دقائق.");
  } else if (data.heartRate.status === "low") {
    candidates.push("معدل نبضك أقل من المعتاد قليلاً. راقب حالتك، وإذا شعرت بدوار راجع مختصاً.");
  }

  // ضغط الدم
  if (data.bloodPressure.status === "high") {
    candidates.push("ضغط الدم لديك يبدو مرتفعاً قليلاً. حاول تقليل الملح والتوتر ومتابعة القراءات.");
  } else if (data.bloodPressure.status === "low") {
    candidates.push("ضغط الدم لديك منخفض قليلاً. اشرب ماء كافياً واحرص على وجبات منتظمة.");
  }

  // SpO2 — فقط إذا توفرت البيانات
  if (data.spo2) {
    const spo2Val = data.spo2.latest ?? data.spo2.average ?? null;
    if (typeof spo2Val === "number" && spo2Val < 94) {
      candidates.push("مستوى الأوكسجين في دمك يستحق الانتباه. تنفّس بعمق وراقب حالتك.");
    } else if (data.spo2.status === "low" || data.spo2.status === "warning") {
      candidates.push("مستوى الأوكسجين يحتاج انتباهاً. راقب حالتك وتنفّس بعمق.");
    }
  }

  // كل شيء جيد
  if (candidates.length === 0) {
    if (data.score >= 80) {
      candidates.push("مؤشراتك اليوم ممتازة. استمر بهذا النسق الصحي الرائع!");
    } else {
      candidates.push("مؤشراتك اليوم جيدة. استمر بهذا النسق الصحي ولا تنسَ الماء والحركة.");
    }
  }

  return candidates[0];
}

// ── تسميات النشاط ────────────────────────────────────────────────────────────
export function getActivityLabel(level: ActivityLevel | string): string {
  switch (level) {
    case "low": return "منخفض";
    case "moderate": return "متوسط";
    case "good": return "جيد";
    case "excellent": return "ممتاز";
    default: return "غير متوفر";
  }
}

// ── تسمية الدرجة الصحية ──────────────────────────────────────────────────────
export function getHealthScoreLabel(score: number): string {
  if (score >= 85) return "ممتاز";
  if (score >= 65) return "جيد";
  if (score >= 45) return "يحتاج انتباه";
  return "راقب صحتك";
}

// ── لون الحالة ───────────────────────────────────────────────────────────────
export function getStatusColor(status: HeartRateStatus | BPStatus | string): string {
  switch (status) {
    case "normal": return "#22C55E";
    case "good": case "excellent": return "#22C55E";
    case "high": return "#F97316";
    case "low": return "#EAB308";
    default: return "#9CA3AF";
  }
}

// ── عرض شريط النشاط (0 إلى 100) ─────────────────────────────────────────────
export function getActivityBarPercent(level: ActivityLevel | string): number {
  switch (level) {
    case "low": return 20;
    case "moderate": return 55;
    case "good": return 75;
    case "excellent": return 95;
    default: return 0;
  }
}
