// HealthData Service — يُعيد بيانات HealthSummary موحّدة
// المصادر المستقبلية: Health Connect (Android) / HealthKit (iOS)
// تحتاج هذه المصادر إلى Development Build وليس Expo Go

import AsyncStorage from "@react-native-async-storage/async-storage";

export type HeartRateStatus = "normal" | "high" | "low" | "unavailable";
export type BPStatus = "normal" | "high" | "low" | "unavailable";
export type ActivityLevel = "low" | "moderate" | "good" | "excellent";
export type SleepQuality = "poor" | "fair" | "good" | "excellent" | "unavailable";
export type DataSource = "mock" | "healthkit" | "healthconnect" | "none";

export interface HealthSummary {
  heartRate: { value: number | null; status: HeartRateStatus };
  bloodPressure: {
    systolic: number | null;
    diastolic: number | null;
    status: BPStatus;
  };
  activity: {
    level: ActivityLevel;
    steps: number | null;
    activeMinutes: number | null;
  };
  sleep: { hours: number | null; quality: SleepQuality };
  score: number;
  isConnected: boolean;
  source: DataSource;
}

// ── مفاتيح AsyncStorage ───────────────────────────────────────────────────────
const STORAGE_KEYS = {
  healthCache: "@taryaq_health_cache",
  lastSyncAt: "@taryaq_health_last_sync",
  modalDismissed: "@taryaq_health_modal_dismissed",
} as const;

// ── تطبيع آمن للبيانات — يمنع الـ crash إذا كانت أي قيمة undefined ──────────
export function normalizeHealthSummary(
  raw: Partial<HealthSummary> | undefined | null
): HealthSummary {
  const EMPTY: HealthSummary = {
    heartRate: { value: null, status: "unavailable" },
    bloodPressure: { systolic: null, diastolic: null, status: "unavailable" },
    activity: { level: "moderate", steps: null, activeMinutes: null },
    sleep: { hours: null, quality: "unavailable" },
    score: 0,
    isConnected: false,
    source: "none",
  };
  if (!raw) return EMPTY;
  return {
    heartRate: {
      value: typeof raw.heartRate?.value === "number" ? raw.heartRate.value : null,
      status: raw.heartRate?.status ?? "unavailable",
    },
    bloodPressure: {
      systolic: typeof raw.bloodPressure?.systolic === "number" ? raw.bloodPressure.systolic : null,
      diastolic: typeof raw.bloodPressure?.diastolic === "number" ? raw.bloodPressure.diastolic : null,
      status: raw.bloodPressure?.status ?? "unavailable",
    },
    activity: {
      level: raw.activity?.level ?? "moderate",
      steps: typeof raw.activity?.steps === "number" ? raw.activity.steps : null,
      activeMinutes: typeof raw.activity?.activeMinutes === "number" ? raw.activity.activeMinutes : null,
    },
    sleep: {
      hours: typeof raw.sleep?.hours === "number" ? raw.sleep.hours : null,
      quality: raw.sleep?.quality ?? "unavailable",
    },
    score: typeof raw.score === "number" ? Math.max(0, Math.min(100, raw.score)) : 0,
    isConnected: raw.isConnected === true,
    source: raw.source ?? "none",
  };
}

// ── AsyncStorage: حفظ وتحميل آخر بيانات ─────────────────────────────────────
export async function saveHealthCache(data: HealthSummary): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.healthCache, JSON.stringify(data)],
      [STORAGE_KEYS.lastSyncAt, String(Date.now())],
    ]);
  } catch {
    // صمت — أخطاء التخزين لا تؤثر على الواجهة
  }
}

export async function loadHealthCache(): Promise<{
  data: HealthSummary;
  lastSyncAt: number;
} | null> {
  try {
    const values = await AsyncStorage.multiGet([
      STORAGE_KEYS.healthCache,
      STORAGE_KEYS.lastSyncAt,
    ]);
    const raw = values[0][1];
    const ts = values[1][1];
    if (!raw) return null;
    return {
      data: normalizeHealthSummary(JSON.parse(raw) as Partial<HealthSummary>),
      lastSyncAt: ts ? parseInt(ts, 10) : 0,
    };
  } catch {
    return null;
  }
}

// ── AsyncStorage: حالة مودال الربط ───────────────────────────────────────────
export async function saveDismissedModal(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.modalDismissed, "1");
  } catch {
    // صمت
  }
}

export async function hasDismissedModal(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.modalDismissed);
    return val === "1";
  } catch {
    return false;
  }
}

// ── هل المصدر متصل فعلاً (ليس mock ولا none) ─────────────────────────────────
export function isHealthConnected(data: HealthSummary): boolean {
  return data.isConnected && data.source !== "mock" && data.source !== "none";
}

// ── جلب البيانات الصحية ───────────────────────────────────────────────────────
// حالياً: mock data فقط
// مستقبلاً: Platform.OS === 'android' → Health Connect | 'ios' → HealthKit
export async function fetchHealthSummary(): Promise<HealthSummary> {
  // TODO (Phase 2): تفعيل Health Connect على Android
  //   يحتاج: react-native-health-connect + Development Build
  //   import { readRecords } from 'react-native-health-connect';
  //
  // TODO (Phase 2): تفعيل HealthKit على iOS
  //   يحتاج: react-native-health + Development Build
  //   import AppleHealthKit from 'react-native-health';

  const { DEV_MOCK_HEALTH } = await import("./mockHealthData");
  return normalizeHealthSummary(DEV_MOCK_HEALTH);
}
