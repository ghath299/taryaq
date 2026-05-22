// DEV MOCK HEALTH DATA — بيانات تجريبية فقط، ستُستبدل بـ Health Connect / HealthKit
import type { HealthSummary } from "./healthDataService";

export const DEV_MOCK_HEALTH: HealthSummary = {
  heartRate: { value: 72, status: "normal" },
  bloodPressure: { systolic: 120, diastolic: 80, status: "normal" },
  activity: { level: "moderate", steps: 4200, activeMinutes: 28 },
  sleep: { hours: 6.5, quality: "fair" },
  // spo2 تجريبي: قيمة منخفضة (91%) لاختبار oxygen_low في DEV
  spo2: { latest: 91, average: 92, status: "low" },
  score: 68,
  isConnected: false,
  source: "mock",
};
