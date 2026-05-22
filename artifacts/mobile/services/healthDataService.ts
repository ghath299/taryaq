// HealthData Service — يُعيد بيانات HealthSummary موحّدة
// Android: Health Connect (react-native-health-connect) — يحتاج Development Build
// iOS:     HealthKit — غير مفعّل بعد
// Web:     Mock دائماً

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isHealthConnectAvailable,
  initializeHealthConnect,
  getGrantedHealthPermissions,
  readTodayHealthConnectSummary,
} from "./healthConnectAdapter";

export type HeartRateStatus = "normal" | "high" | "low" | "unavailable";
export type BPStatus = "normal" | "high" | "low" | "unavailable";
export type ActivityLevel = "low" | "moderate" | "good" | "excellent";
export type SleepQuality = "poor" | "fair" | "good" | "excellent" | "unavailable";
export type DataSource = "mock" | "healthkit" | "healthconnect" | "none";
export type Spo2Status = "normal" | "low" | "warning" | "unknown";

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
  // SpO2 — اختياري: يُملأ عند توفر Health Connect / HealthKit
  spo2?: {
    latest?: number | null;
    average?: number | null;
    status?: Spo2Status;
  };
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
  const normalized: HealthSummary = {
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
  // spo2 اختياري: يُضاف فقط إذا كانت البيانات موجودة
  if (raw.spo2 !== undefined) {
    normalized.spo2 = {
      latest:  typeof raw.spo2?.latest  === "number" ? raw.spo2.latest  : null,
      average: typeof raw.spo2?.average === "number" ? raw.spo2.average : null,
      status:  raw.spo2?.status ?? "unknown",
    };
  }
  return normalized;
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

// ── Mock / Fallback فارغ ──────────────────────────────────────────────────────
const EMPTY_SUMMARY: HealthSummary = {
  heartRate:     { value: null, status: "unavailable" },
  bloodPressure: { systolic: null, diastolic: null, status: "unavailable" },
  activity:      { level: "moderate", steps: null, activeMinutes: null },
  sleep:         { hours: null, quality: "unavailable" },
  score: 0,
  isConnected: false,
  source: "none",
};

async function getMockSummary(): Promise<HealthSummary> {
  const { DEV_MOCK_HEALTH } = await import("./mockHealthData");
  return normalizeHealthSummary(DEV_MOCK_HEALTH);
}

// ── جلب البيانات الصحية ───────────────────────────────────────────────────────
export async function fetchHealthSummary(): Promise<HealthSummary> {
  // Web: mock دائماً (Expo Web Preview)
  if (Platform.OS === "web") {
    return getMockSummary();
  }

  // iOS: HealthKit غير مفعّل بعد
  if (Platform.OS === "ios") {
    if (__DEV__) return getMockSummary();
    return { ...EMPTY_SUMMARY };
  }

  // Android: حاول Health Connect أولاً
  try {
    const available = await isHealthConnectAvailable();

    if (!available) {
      // Health Connect غير متوفر (جهاز قديم أو لم يُثبَّت)
      if (__DEV__) return getMockSummary();
      return { ...EMPTY_SUMMARY };
    }

    await initializeHealthConnect();

    const granted = await getGrantedHealthPermissions();
    if (granted.length === 0) {
      // لم تُمنح صلاحيات بعد — في DEV نعرض بيانات تجريبية
      if (__DEV__) return getMockSummary();
      return { ...EMPTY_SUMMARY };
    }

    const data = await readTodayHealthConnectSummary();
    if (data) return data;
  } catch {
    // أي خطأ غير متوقع → نعود للـ fallback
  }

  if (__DEV__) return getMockSummary();
  return { ...EMPTY_SUMMARY };
}
