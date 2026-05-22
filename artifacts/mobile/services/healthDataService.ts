// HealthData Service — يُعيد بيانات HealthSummary موحّدة
// المصادر المستقبلية: Health Connect (Android) / HealthKit (iOS)
// تحتاج هذه المصادر إلى Development Build وليس Expo Go

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

// ── تحقق من حالة الاتصال ─────────────────────────────────────────────────────
export function isHealthConnected(data: HealthSummary): boolean {
  return data.isConnected && data.source !== "mock" && data.source !== "none";
}

// ── جلب البيانات الصحية ──────────────────────────────────────────────────────
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
  return { ...DEV_MOCK_HEALTH };
}
