import {
  ref,
  set,
  update,
  push,
  get,
  onValue,
  off,
  serverTimestamp,
  type DataSnapshot,
} from "firebase/database";
import { database } from "@/lib/firebase";

export interface FirebaseUser {
  id: string;
  name: string;
  phone: string;
  fcmToken?: string | null;
  createdAt?: number | object;
  updatedAt?: number | object;
}

export interface FirebaseClinic {
  doctorName: string;
  specialty: string;
  profilePhoto?: string;
  coverPhoto?: string;
  location?: { lat: number; lng: number; address: string };
  workingHours?: { start: string; end: string };
  workingDays?: string[];
  appointmentDuration?: number;
  maxPatientsPerDay?: number;
  settings?: Record<string, unknown>;
}

export type BookingStatus = "انتظار" | "مقبول" | "مرفوض" | "مكتمل" | "لم يحضر";

export type PaymentMethod =
  | "cash"
  | "zaincash"
  | "fastpay"
  | "asiahawala"
  | "qicard"
  | "fib"
  | "nasspay";

export type PaymentStatus = "غير مدفوع" | "قيد الدفع" | "مدفوع" | "فشل";

export type EscrowStatus =
  | "pending"
  | "held"
  | "paid"
  | "refunded"
  | "failed";

export interface ClinicPaymentSettings {
  electronicPaymentEnabled: boolean;
  /** آخر 4 أرقام فقط من البطاقة (لا تخزّن الرقم الكامل على العميل) */
  qiCardLast4?: string;
  cardHolderName?: string;
  merchantId?: string;
  /** يجب أن يبقى فارغاً على العميل ويُحفظ على الخادم فقط */
  apiKey?: string;
  updatedAt?: number | object;
}

export interface FirebaseTransaction {
  clinicId: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  currency: "IQD";
  status: EscrowStatus;
  method: "cash" | "qi_card";
  createdAt: number | object;
  updatedAt?: number | object;
  refundId?: string;
}

export interface FirebaseBooking {
  patientName: string;
  accountOwnerName: string;
  accountOwnerId: string;
  age: number;
  phone: string;
  reason: string;
  date: string;
  time: string;
  estimatedTime?: string;
  queueNumber?: number;
  status: BookingStatus;
  autoBooked?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentTxId?: string;
  paymentPaidAt?: number | object;
  payment?: {
    method: PaymentMethod;
    status: EscrowStatus | "unpaid";
    transactionId?: string;
    amount?: number;
    paidAt?: number | object;
    releasedAt?: number | object;
    refundedAt?: number | object;
  };
  createdAt?: number | object;
  completedAt?: number | object;
  enteredAt?: number | object;
  exitedAt?: number | object;
}

function userIdFromPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export async function saveUser(params: {
  phone: string;
  name: string;
  fcmToken?: string | null;
}): Promise<FirebaseUser> {
  const id = userIdFromPhone(params.phone);
  const userRef = ref(database, `users/${id}`);
  const existing = await get(userRef);

  const data: FirebaseUser = {
    id,
    name: params.name,
    phone: params.phone,
    fcmToken: params.fcmToken ?? (existing.val()?.fcmToken ?? null),
    createdAt: existing.exists() ? existing.val().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await set(userRef, data);
  return data;
}

export async function updateUserFcmToken(phone: string, fcmToken: string): Promise<void> {
  const id = userIdFromPhone(phone);
  await update(ref(database, `users/${id}`), {
    fcmToken,
    updatedAt: serverTimestamp(),
  });
}

export async function getUser(phone: string): Promise<FirebaseUser | null> {
  const id = userIdFromPhone(phone);
  const snap = await get(ref(database, `users/${id}`));
  return snap.exists() ? (snap.val() as FirebaseUser) : null;
}

export function subscribeToClinic(
  clinicId: string,
  callback: (clinic: FirebaseClinic | null) => void
): () => void {
  const clinicRef = ref(database, `clinics/${clinicId}`);
  const handler = (snap: DataSnapshot) => {
    callback(snap.exists() ? (snap.val() as FirebaseClinic) : null);
  };
  onValue(clinicRef, handler);
  return () => off(clinicRef, "value", handler);
}

export async function getClinic(clinicId: string): Promise<FirebaseClinic | null> {
  const snap = await get(ref(database, `clinics/${clinicId}`));
  return snap.exists() ? (snap.val() as FirebaseClinic) : null;
}

export async function createBooking(
  clinicId: string,
  booking: Omit<FirebaseBooking, "createdAt" | "status"> & { status?: BookingStatus }
): Promise<string> {
  const bookingsRef = ref(database, `clinics/${clinicId}/bookings`);
  const newRef = push(bookingsRef);
  const data: FirebaseBooking = {
    ...booking,
    status: booking.status ?? "انتظار",
    createdAt: serverTimestamp(),
  };
  await set(newRef, data);
  return newRef.key as string;
}

export function subscribeToUserBookings(
  accountOwnerId: string,
  callback: (bookings: Array<FirebaseBooking & { id: string; clinicId: string }>) => void
): () => void {
  const clinicsRef = ref(database, "clinics");
  const handler = (snap: DataSnapshot) => {
    const result: Array<FirebaseBooking & { id: string; clinicId: string }> = [];
    if (snap.exists()) {
      const clinics = snap.val() as Record<string, { bookings?: Record<string, FirebaseBooking> }>;
      for (const [clinicId, clinic] of Object.entries(clinics)) {
        if (!clinic.bookings) continue;
        for (const [bookingId, booking] of Object.entries(clinic.bookings)) {
          if (booking.accountOwnerId === accountOwnerId) {
            result.push({ ...booking, id: bookingId, clinicId });
          }
        }
      }
    }
    callback(result);
  };
  onValue(clinicsRef, handler);
  return () => off(clinicsRef, "value", handler);
}

export async function updateBookingStatus(
  clinicId: string,
  bookingId: string,
  status: BookingStatus,
  extra?: Partial<FirebaseBooking>
): Promise<void> {
  await update(ref(database, `clinics/${clinicId}/bookings/${bookingId}`), {
    status,
    ...(extra || {}),
  });
}

/* -------------------- Clinic payment settings -------------------- */

export async function getClinicPaymentSettings(
  clinicId: string,
): Promise<ClinicPaymentSettings | null> {
  const snap = await get(ref(database, `clinics/${clinicId}/payment`));
  return snap.exists() ? (snap.val() as ClinicPaymentSettings) : null;
}

export async function updateClinicPaymentSettings(
  clinicId: string,
  settings: Partial<ClinicPaymentSettings>,
): Promise<void> {
  await update(ref(database, `clinics/${clinicId}/payment`), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToClinicPaymentSettings(
  clinicId: string,
  callback: (settings: ClinicPaymentSettings | null) => void,
): () => void {
  const r = ref(database, `clinics/${clinicId}/payment`);
  const handler = (snap: DataSnapshot) =>
    callback(snap.exists() ? (snap.val() as ClinicPaymentSettings) : null);
  onValue(r, handler);
  return () => off(r, "value", handler);
}

/* -------------------- Transactions -------------------- */

export async function getTransaction(
  transactionId: string,
): Promise<FirebaseTransaction | null> {
  const snap = await get(ref(database, `transactions/${transactionId}`));
  return snap.exists() ? (snap.val() as FirebaseTransaction) : null;
}

export function subscribeToClinicTransactions(
  clinicId: string,
  callback: (
    transactions: Array<FirebaseTransaction & { id: string }>,
  ) => void,
): () => void {
  const r = ref(database, "transactions");
  const handler = (snap: DataSnapshot) => {
    const out: Array<FirebaseTransaction & { id: string }> = [];
    if (snap.exists()) {
      const all = snap.val() as Record<string, FirebaseTransaction>;
      for (const [id, tx] of Object.entries(all)) {
        if (tx.clinicId === clinicId) out.push({ ...tx, id });
      }
    }
    callback(out);
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}
