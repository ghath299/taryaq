// healthConnectAdapter.ts — Android Health Connect 3.x adapter
// Android only: جميع الدوال تعود فارغة على iOS/Web
// لا HealthKit، لا BLE، لا تغيير على تصميم الصفحة الرئيسية

import { Platform } from "react-native";
import type {
  StepsRecord,
  HeartRateRecord,
  RestingHeartRateRecord,
  SleepSessionRecord,
  OxygenSaturationRecord,
  BloodPressureRecord,
  TotalCaloriesBurnedRecord,
  Permission,
} from "react-native-health-connect";
import type { HealthSummary, HeartRateStatus, BPStatus, Spo2Status } from "./healthDataService";

const HC_PROVIDER = "com.google.android.apps.healthdata";

const READ_PERMISSIONS: Permission[] = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "HeartRate" },
  { accessType: "read", recordType: "RestingHeartRate" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "OxygenSaturation" },
  { accessType: "read", recordType: "BloodPressure" },
  { accessType: "read", recordType: "TotalCaloriesBurned" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
];

// مساعد: تحميل المكتبة بشكل آمن (Android فقط)
async function loadHC() {
  if (Platform.OS !== "android") return null;
  try {
    return await import("react-native-health-connect");
  } catch {
    return null;
  }
}

// ── 1. هل Health Connect متاح على الجهاز؟ ────────────────────────────────────
export async function isHealthConnectAvailable(): Promise<boolean> {
  const hc = await loadHC();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus(HC_PROVIDER);
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// ── 2. تهيئة Health Connect ───────────────────────────────────────────────────
export async function initializeHealthConnect(): Promise<boolean> {
  const hc = await loadHC();
  if (!hc) return false;
  try {
    return await hc.initialize(HC_PROVIDER);
  } catch {
    return false;
  }
}

// ── 3. طلب صلاحيات القراءة ───────────────────────────────────────────────────
export async function requestHealthConnectPermissions(): Promise<boolean> {
  const hc = await loadHC();
  if (!hc) return false;
  try {
    const granted = await hc.requestPermission(READ_PERMISSIONS);
    return granted.length > 0;
  } catch {
    return false;
  }
}

// ── 4. الصلاحيات الممنوحة حالياً ─────────────────────────────────────────────
export async function getGrantedHealthPermissions(): Promise<string[]> {
  const hc = await loadHC();
  if (!hc) return [];
  try {
    const granted = await hc.getGrantedPermissions();
    return granted.map((p) => p.recordType);
  } catch {
    return [];
  }
}

// ── 5. فتح إعدادات Health Connect ────────────────────────────────────────────
export async function openHealthConnectSettingsScreen(): Promise<void> {
  const hc = await loadHC();
  if (!hc) return;
  try {
    hc.openHealthConnectSettings();
  } catch {}
}

// ── 6. قراءة ملخص بيانات اليوم وتحويلها إلى HealthSummary ───────────────────
export async function readTodayHealthConnectSummary(): Promise<HealthSummary | null> {
  const hc = await loadHC();
  if (!hc) return null;
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const timeRangeFilter = {
      operator: "between" as const,
      startTime: startOfDay.toISOString(),
      endTime:   now.toISOString(),
    };

    const [stepsRes, hrRes, restHrRes, sleepRes, spo2Res, bpRes, calRes] =
      await Promise.allSettled([
        hc.readRecords("Steps",               { timeRangeFilter }),
        hc.readRecords("HeartRate",           { timeRangeFilter }),
        hc.readRecords("RestingHeartRate",    { timeRangeFilter }),
        hc.readRecords("SleepSession",        { timeRangeFilter }),
        hc.readRecords("OxygenSaturation",    { timeRangeFilter }),
        hc.readRecords("BloodPressure",       { timeRangeFilter }),
        hc.readRecords("TotalCaloriesBurned", { timeRangeFilter }),
      ]);

    // ── خطوات ─────────────────────────────────────────────────────────────────
    let totalSteps: number | null = null;
    if (stepsRes.status === "fulfilled") {
      const recs = (stepsRes.value as unknown as { records: StepsRecord[] }).records;
      if (recs.length > 0) totalSteps = recs.reduce((s, r) => s + r.count, 0);
    }

    // ── نبض القلب ─────────────────────────────────────────────────────────────
    let hrValue: number | null = null;
    let hrStatus: HeartRateStatus = "unavailable";
    if (hrRes.status === "fulfilled") {
      const recs = (hrRes.value as unknown as { records: HeartRateRecord[] }).records;
      const samples = recs.flatMap((r) => r.samples);
      if (samples.length > 0) {
        hrValue  = Math.round(samples.reduce((s, x) => s + x.beatsPerMinute, 0) / samples.length);
        hrStatus = hrValue > 100 ? "high" : hrValue < 50 ? "low" : "normal";
      }
    }
    if (hrValue === null && restHrRes.status === "fulfilled") {
      const recs = (restHrRes.value as unknown as { records: RestingHeartRateRecord[] }).records;
      if (recs.length > 0) {
        hrValue  = recs[recs.length - 1].beatsPerMinute;
        hrStatus = hrValue > 100 ? "high" : hrValue < 50 ? "low" : "normal";
      }
    }

    // ── النوم ──────────────────────────────────────────────────────────────────
    let sleepHours: number | null = null;
    let sleepQuality: "poor" | "fair" | "good" | "excellent" | "unavailable" = "unavailable";
    if (sleepRes.status === "fulfilled") {
      const recs = (sleepRes.value as unknown as { records: SleepSessionRecord[] }).records;
      if (recs.length > 0) {
        const totalMs = recs.reduce(
          (s, r) => s + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()),
          0,
        );
        sleepHours  = parseFloat((totalMs / 3_600_000).toFixed(1));
        sleepQuality = sleepHours >= 7 ? "good" : sleepHours >= 5 ? "fair" : "poor";
      }
    }

    // ── SpO2 ───────────────────────────────────────────────────────────────────
    let spo2Latest: number | null = null;
    let spo2Avg:    number | null = null;
    let spo2Status: Spo2Status    = "unknown";
    if (spo2Res.status === "fulfilled") {
      const recs = (spo2Res.value as unknown as { records: OxygenSaturationRecord[] }).records;
      if (recs.length > 0) {
        spo2Latest = recs[recs.length - 1].percentage;
        spo2Avg    = parseFloat(
          (recs.reduce((s, r) => s + r.percentage, 0) / recs.length).toFixed(1),
        );
        const val = spo2Latest;
        spo2Status = val < 90 ? "low" : val < 94 ? "warning" : "normal";
      }
    }

    // ── ضغط الدم ───────────────────────────────────────────────────────────────
    let systolic:  number | null = null;
    let diastolic: number | null = null;
    let bpStatus:  BPStatus      = "unavailable";
    if (bpRes.status === "fulfilled") {
      type BPRec = { systolic: { inMillimetersOfMercury: number }; diastolic: { inMillimetersOfMercury: number } };
      const recs = (bpRes.value as unknown as { records: (BloodPressureRecord & BPRec)[] }).records;
      if (recs.length > 0) {
        const last = recs[recs.length - 1];
        systolic  = Math.round(last.systolic.inMillimetersOfMercury);
        diastolic = Math.round(last.diastolic.inMillimetersOfMercury);
        bpStatus  = systolic > 140 || diastolic > 90 ? "high"
                  : systolic < 90  || diastolic < 60  ? "low"
                  : "normal";
      }
    }

    // ── مستوى النشاط ───────────────────────────────────────────────────────────
    const activityLevel =
      totalSteps === null   ? "low"
      : totalSteps >= 10000 ? "excellent"
      : totalSteps >= 7000  ? "good"
      : totalSteps >= 4000  ? "moderate"
      : "low";

    // ── السعرات ────────────────────────────────────────────────────────────────
    if (calRes.status === "fulfilled") {
      const recs = (calRes.value as unknown as { records: (TotalCaloriesBurnedRecord & { energy: { inKilocalories: number } })[] }).records;
      void recs; // محفوظ للاستخدام المستقبلي في الإحصائيات
    }

    // ── الدرجة الكلية ──────────────────────────────────────────────────────────
    let score = 50;
    if (hrStatus === "normal")              score += 15;
    else if (hrStatus !== "unavailable")    score -= 10;
    if (sleepHours !== null) {
      if (sleepHours >= 7)  score += 15;
      else if (sleepHours < 5) score -= 10;
    }
    if (totalSteps !== null) {
      if (totalSteps >= 6000)  score += 15;
      else if (totalSteps < 3000) score -= 10;
    }
    if (bpStatus   === "normal") score += 10;
    if (spo2Status === "normal") score +=  5;
    score = Math.max(0, Math.min(100, score));

    const summary: HealthSummary = {
      heartRate:     { value: hrValue,   status: hrStatus },
      bloodPressure: { systolic, diastolic, status: bpStatus },
      activity:      { level: activityLevel, steps: totalSteps, activeMinutes: null },
      sleep:         { hours: sleepHours, quality: sleepQuality },
      ...(spo2Latest !== null || spo2Avg !== null
        ? { spo2: { latest: spo2Latest, average: spo2Avg, status: spo2Status } }
        : {}),
      score,
      isConnected: true,
      source: "healthconnect",
    };

    return summary;
  } catch {
    return null;
  }
}
