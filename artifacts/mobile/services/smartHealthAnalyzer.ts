// Smart Health Analyzer — يأخذ HealthSummary ويُعيد نصيحة ذكية باللغة العربية
// ممنوع استخدام: خطر / مرض / تشخيص / علاج
// المستخدم: لاحظنا / قد يساعدك / راقب حالتك

import type { HealthSummary, ActivityLevel, HeartRateStatus, BPStatus } from "./healthDataService";

// ── النصيحة الذكية ────────────────────────────────────────────────────────────
export function getSmartHealthTip(data: HealthSummary): string {
  const candidates: string[] = [];

  // النوم
  if (data.sleep.hours !== null) {
    if (data.sleep.hours < 5.5) {
      candidates.push("نومك كان أقل من المعتاد. حاول تنظيم وقت نومك الليلة لتشعر بطاقة أفضل.");
    } else if (data.sleep.hours < 7 || data.sleep.quality === "poor") {
      candidates.push("جودة نومك تحتاج تحسيناً. ابتعد عن الشاشات قبل النوم بساعة وستلاحظ فرقاً.");
    }
  }

  // النشاط والخطوات
  if (data.activity.level === "low") {
    candidates.push("نشاطك اليوم أقل من المعتاد. المشي لدقائق بسيطة قد يساعدك على الشعور بنشاط أكبر.");
  } else if (data.activity.steps !== null && data.activity.steps < 3000) {
    candidates.push("خطواتك اليوم قليلة. حاول التحرك أكثر ولو لمسافات قصيرة بين المهام.");
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
